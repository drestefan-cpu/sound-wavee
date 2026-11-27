import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { generateAppleDeveloperToken } from "../_shared/links.ts"
import { getSpotifyAppToken } from "../_shared/spotify.ts"

/**
 * The artist section of the song screen: photos, latest releases, a short bio and socials,
 * for a song's main artist. Body: { track_id }.
 *  - photos + releases: Apple Music (portrait + album covers), Spotify (profile photo), Wikipedia
 *  - bio: Wikipedia (via Wikidata)
 *  - socials: MusicBrainz's links for the artist (Instagram, TikTok, X, YouTube, SoundCloud, site…)
 * Instagram / Spotify galleries aren't open to other apps, so they aren't used.
 * Cached per artist for 7 days in artist_details.
 */

const CACHE_DAYS = 7
const MB_HEADERS = { "User-Agent": "PLAI/1.0 ( https://plai.delaneyprojects.xyz )", Accept: "application/json" }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Photo = { url: string; source: string }
type Release = { id: string; title: string; year: string | null; art: string; url: string | null }
type Links = Partial<Record<"instagram" | "tiktok" | "x" | "youtube" | "soundcloud" | "bandcamp" | "website" | "spotify" | "apple_music", string>>
type ArtistDetails = {
  name: string
  genres: string[]
  photos: Photo[]
  releases: Release[]
  bio: { text: string; url: string } | null
  links: Links
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
const isPlaceholder = (id: string | null) => /^(tidal_|apple:|yt:|share:)/.test(id || "")

// ── Apple Music: portrait, genres, latest releases ────────────────────────────
async function fromApple(name: string, appleSongId: string | null, isrc: string | null) {
  const token = await generateAppleDeveloperToken()
  if (!token) return null
  const h = { Authorization: `Bearer ${token}` }
  const base = "https://api.music.apple.com/v1/catalog/us"
  let artistId: string | null = null

  const song = appleSongId
    ? await getJson(`${base}/songs/${appleSongId}?include=artists`, h)
    : isrc
      ? await getJson(`${base}/songs?filter[isrc]=${encodeURIComponent(isrc)}&include=artists`, h)
      : null
  for (const a of song?.data?.[0]?.relationships?.artists?.data || []) {
    if (same(a.attributes?.name, name) || !artistId) artistId = a.id
    if (same(a.attributes?.name, name)) break
  }
  if (!artistId) {
    const found = await getJson(`${base}/search?types=artists&limit=3&term=${encodeURIComponent(name)}`, h)
    const hit = (found?.results?.artists?.data || []).find((a: any) => same(a.attributes?.name, name))
    artistId = hit?.id || null
  }
  if (!artistId) return null

  const [artist, albums] = await Promise.all([
    getJson(`${base}/artists/${artistId}`, h),
    getJson(`${base}/artists/${artistId}/albums?limit=25`, h),
  ])
  const a = artist?.data?.[0]?.attributes
  const art = (t?: string, size = 800) => (t ? t.replace("{w}", String(size)).replace("{h}", String(size)).replace("{f}", "jpg") : null)
  // newest first; one entry per title (Apple lists clean / explicit / deluxe versions separately)
  const seen = new Set<string>()
  const releases: Release[] = ((albums?.data || []) as any[])
    .map((al) => ({ ...al.attributes, _id: String(al.id) }))
    .filter((x) => x?.artwork?.url && !x.isCompilation)
    .sort((x, y) => String(y.releaseDate || "").localeCompare(String(x.releaseDate || "")))
    .map((x) => {
      const kind = / - single$/i.test(x.name) ? "single" : / - ep$/i.test(x.name) ? "EP" : null
      const title = String(x.name).replace(/ - (single|ep)$/i, "")
      return { x, title, kind }
    })
    .filter(({ title }) => {
      const k = title.toLowerCase().replace(/\s*[([](deluxe|clean|explicit|expanded|bonus)[^)\]]*[)\]]/g, "").trim()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 8)
    .map(({ x, title, kind }) => ({
      id: x._id,
      title,
      year: [x.releaseDate ? String(x.releaseDate).slice(0, 4) : null, kind].filter(Boolean).join(" · ") || null,
      art: art(x.artwork.url, 500)!,
      url: x.url || null,
    }))
  return {
    photo: art(a?.artwork?.url),
    genres: ((a?.genreNames || []) as string[]).filter((g) => g !== "Music"),
    releases,
    url: a?.url || null,
  }
}

// ── Spotify: profile photo + artist page ──────────────────────────────────────
async function fromSpotify(name: string, spotifyTrackId: string | null) {
  const token = await getSpotifyAppToken()
  if (!token) return null
  const h = { Authorization: `Bearer ${token}` }
  let artistId: string | null = null
  if (spotifyTrackId) {
    const t = await getJson(`https://api.spotify.com/v1/tracks/${spotifyTrackId}`, h)
    const list = (t?.artists || []) as any[]
    artistId = (list.find((a) => same(a.name, name)) || list[0])?.id || null
  }
  if (!artistId) {
    const s = await getJson(`https://api.spotify.com/v1/search?type=artist&limit=5&q=${encodeURIComponent(name)}`, h)
    artistId = ((s?.artists?.items || []) as any[]).find((a) => same(a.name, name))?.id || null
  }
  if (!artistId) return null
  const a = await getJson(`https://api.spotify.com/v1/artists/${artistId}`, h)
  return { photo: a?.images?.[0]?.url || null, url: a?.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}` }
}

// ── MusicBrainz: socials and website (and the Wikidata link for the bio) ──────
async function fromMusicBrainz(name: string, isrc: string | null) {
  let mbid: string | null = null
  if (isrc) {
    const r = await getJson(`https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?inc=artist-credits&fmt=json`, MB_HEADERS)
    for (const rec of r?.recordings || []) {
      const credit = ((rec["artist-credit"] || []) as any[]).find((c) => same(c.artist?.name, name) || same(c.name, name))
      if (credit) {
        mbid = credit.artist.id
        break
      }
    }
    await sleep(1100) // MusicBrainz allows one request a second
  }
  if (!mbid) {
    const s = await getJson(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=3&fmt=json`, MB_HEADERS)
    const hit = ((s?.artists || []) as any[]).find((a) => same(a.name, name) && Number(a.score) >= 90)
    mbid = hit?.id || null
    await sleep(1100)
  }
  if (!mbid) return null
  const a = await getJson(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`, MB_HEADERS)
  const links: Links = {}
  let wikidata: string | null = null
  for (const rel of (a?.relations || []) as any[]) {
    const url: string = rel?.url?.resource || ""
    if (rel.ended) continue
    let host = ""
    try {
      host = new URL(url).hostname.replace(/^www\./, "")
    } catch {
      continue
    }
    if (host === "instagram.com") links.instagram ||= url
    else if (host.endsWith("tiktok.com")) links.tiktok ||= url
    else if (host === "twitter.com" || host === "x.com") links.x ||= url.replace("twitter.com", "x.com")
    else if (host.endsWith("youtube.com") && !host.startsWith("music.")) links.youtube ||= url
    else if (host === "soundcloud.com") links.soundcloud ||= url
    else if (host.endsWith("bandcamp.com")) links.bandcamp ||= url
    else if (host === "wikidata.org") wikidata = url.split("/").pop() || null
    else if (rel.type === "official homepage") links.website ||= url
  }
  return { links, wikidata }
}

// ── Wikipedia (via Wikidata): short bio + photo ───────────────────────────────
async function fromWikipedia(qid: string) {
  const entity = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
  const e = entity?.entities?.[qid]
  const file: string | undefined = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  const title: string | undefined = e?.sitelinks?.enwiki?.title
  let bio: ArtistDetails["bio"] = null
  if (title) {
    const sum = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)
    if (sum?.extract && sum.type !== "disambiguation") {
      bio = { text: String(sum.extract).slice(0, 600), url: sum.content_urls?.mobile?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` }
    }
  }
  return {
    bio,
    photo: file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800` : null,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    // { track_id } for songs in PLAI, or { artist, spotify_track_id } for a song playing on Spotify
    // that PLAI hasn't seen yet
    const body = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    let track: { artist: string; spotify_track_id: string | null; spotify_link_id: string | null; apple_music_id: string | null; isrc: string | null } | null = null
    if (body.track_id && /^[0-9a-f-]{36}$/i.test(body.track_id)) {
      const { data } = await admin
        .from("tracks")
        .select("artist, spotify_track_id, spotify_link_id, apple_music_id, isrc")
        .eq("id", body.track_id)
        .maybeSingle()
      track = data
    } else if (typeof body.artist === "string" && body.artist.trim()) {
      const sid = typeof body.spotify_track_id === "string" && /^[A-Za-z0-9]{22}$/.test(body.spotify_track_id) ? body.spotify_track_id : null
      track = { artist: body.artist.trim().slice(0, 200), spotify_track_id: sid, spotify_link_id: null, apple_music_id: null, isrc: null }
    }
    if (!track?.artist) return jsonResponse({ error: "song not found" }, 404)

    // Main artist ("Future, Young Thug, Gunna" → "Future"; keeps names like "Tyler, The Creator")
    const { data: split } = await admin.rpc("split_artists", { p_artist: track.artist })
    const name: string = (Array.isArray(split) && split[0]) || track.artist
    const key = name.toLowerCase()

    const { data: cached } = await admin.from("artist_details").select("data, fetched_at").eq("artist_key", key).maybeSingle()
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86_400_000) {
      return jsonResponse(cached.data)
    }

    const spotifyId = !isPlaceholder(track.spotify_track_id) ? track.spotify_track_id : track.spotify_link_id
    const [apple, spotify, mb] = await Promise.all([
      fromApple(name, track.apple_music_id, track.isrc).catch(() => null),
      fromSpotify(name, spotifyId).catch(() => null),
      fromMusicBrainz(name, track.isrc).catch(() => null),
    ])
    const wiki = mb?.wikidata ? await fromWikipedia(mb.wikidata).catch(() => null) : null

    const photos: Photo[] = []
    // (artists usually give Apple and Spotify the same press photo, so Spotify's is only a fallback)
    for (const [url, source] of [
      [apple?.photo, "Apple Music"],
      [apple?.photo ? null : spotify?.photo, "Spotify"],
      [wiki?.photo, "Wikipedia"],
    ] as const) {
      if (url && !photos.some((p) => p.url === url)) photos.push({ url, source })
    }

    const details: ArtistDetails = {
      name,
      genres: (apple?.genres || []).slice(0, 3),
      photos,
      releases: apple?.releases || [],
      bio: wiki?.bio || null,
      links: {
        ...(mb?.links || {}),
        ...(spotify?.url ? { spotify: spotify.url } : {}),
        ...(apple?.url ? { apple_music: apple.url } : {}),
      },
    }

    await admin.from("artist_details").upsert({ artist_key: key, data: details, fetched_at: new Date().toISOString() })
    return jsonResponse(details)
  } catch (err) {
    console.error("artist-details failed", err)
    return jsonResponse({ error: "couldn't load the artist" }, 500)
  }
})
