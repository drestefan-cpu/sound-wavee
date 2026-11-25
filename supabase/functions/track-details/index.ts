import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { generateAppleDeveloperToken } from "../_shared/links.ts"
import { getSpotifyAppToken } from "../_shared/spotify.ts"

// Details for the track screen: release date, length, genre, label, songwriters, producers and a
// 30-second preview. Sources: Apple Music (catalogue + preview), MusicBrainz (credits, by ISRC),
// Spotify (fallback for date / length / label). Results are cached in track_details.

const CACHE_DAYS = 30
const RETRY_CREDITS_HOURS = 24 // MusicBrainz is rate-limited; if it failed, try again a day later
const MB_HEADERS = { "User-Agent": "PLAI/1.0 ( https://plai.delaneyprojects.xyz )", Accept: "application/json" }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Details = {
  releaseDate?: string | null
  durationMs?: number | null
  genre?: string | null
  label?: string | null
  copyright?: string | null
  explicit?: boolean
  previewUrl?: string | null
  writers?: string[]
  producers?: string[]
  credits?: { role: string; names: string[] }[]
  sources?: string[]
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]

async function fetchApple(appleId: string | null, isrc: string | null) {
  const token = await generateAppleDeveloperToken()
  if (!token) return null
  const headers = { Authorization: `Bearer ${token}` }
  const url = appleId
    ? `https://api.music.apple.com/v1/catalog/us/songs/${appleId}?include=albums`
    : isrc
      ? `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}&include=albums`
      : null
  if (!url) return null
  const res = await fetch(url, { headers })
  if (!res.ok) return null
  const json = await res.json()
  const song = json?.data?.[0]
  if (!song?.attributes) return null
  const album = song.relationships?.albums?.data?.[0]?.attributes || {}
  return { id: String(song.id), a: song.attributes, album }
}

async function fetchMusicBrainz(isrc: string): Promise<{ ok: boolean; writers: string[]; producers: string[]; credits: { role: string; names: string[] }[] }> {
  const empty = { ok: false, writers: [], producers: [], credits: [] }
  try {
    const r1 = await fetch(`https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?fmt=json`, { headers: MB_HEADERS })
    if (r1.status === 404) return { ...empty, ok: true } // not in MusicBrainz: nothing to retry
    if (!r1.ok) return empty
    const recordingId = (await r1.json())?.recordings?.[0]?.id
    if (!recordingId) return { ...empty, ok: true }
    await sleep(1100) // MusicBrainz allows about one request per second
    const r2 = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artist-rels+work-rels+work-level-rels&fmt=json`,
      { headers: MB_HEADERS },
    )
    if (!r2.ok) return empty
    const rec = await r2.json()

    const byRole = new Map<string, string[]>()
    const add = (role: string, name?: string) => {
      if (!name) return
      byRole.set(role, [...(byRole.get(role) || []), name])
    }
    for (const rel of rec.relations || []) {
      if (rel["target-type"] === "artist") {
        const name = rel.artist?.name
        const t = String(rel.type || "")
        if (t === "producer") add("Produced by", name)
        else if (t === "mix") add("Mixed by", name)
        else if (t === "mastering") add("Mastered by", name)
        else if (t === "engineer" || t === "recording") add("Engineered by", name)
        else if (t === "vocal") add("Vocals", name)
        else if (t === "instrument") add((rel.attributes?.[0] ? String(rel.attributes[0]) : "instruments").replace(/^./, (c: string) => c.toUpperCase()), name)
      }
      if (rel["target-type"] === "work") {
        for (const wr of rel.work?.relations || []) {
          if (wr["target-type"] !== "artist") continue
          if (["composer", "lyricist", "writer"].includes(wr.type)) add("Written by", wr.artist?.name)
        }
      }
    }
    const credits = [...byRole.entries()].map(([role, names]) => ({ role, names: uniq(names) }))
    return {
      ok: true,
      writers: uniq(byRole.get("Written by") || []),
      producers: uniq(byRole.get("Produced by") || []),
      credits,
    }
  } catch {
    return empty
  }
}

async function fetchSpotify(spotifyId: string) {
  const token = await getSpotifyAppToken()
  if (!token) return null
  const headers = { Authorization: `Bearer ${token}` }
  const t = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}?market=US`, { headers }).then((r) => (r.ok ? r.json() : null))
  if (!t) return null
  let label: string | null = null
  if (t.album?.id) {
    const al = await fetch(`https://api.spotify.com/v1/albums/${t.album.id}?market=US`, { headers }).then((r) => (r.ok ? r.json() : null))
    label = al?.label || null
  }
  return {
    releaseDate: t.album?.release_date || null,
    durationMs: t.duration_ms || null,
    explicit: !!t.explicit,
    isrc: t.external_ids?.isrc || null,
    label,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const trackId = typeof body.track_id === "string" ? body.track_id : ""
    if (!/^[0-9a-f-]{36}$/i.test(trackId)) return jsonResponse({ error: "track_id required" }, 400)

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const { data: cached } = await admin.from("track_details").select("data, credits_complete, fetched_at").eq("track_id", trackId).maybeSingle()
    if (cached) {
      const ageH = (Date.now() - new Date(cached.fetched_at).getTime()) / 3_600_000
      if (ageH < CACHE_DAYS * 24 && (cached.credits_complete || ageH < RETRY_CREDITS_HOURS)) {
        return jsonResponse({ details: cached.data, cached: true })
      }
    }

    const { data: track } = await admin
      .from("tracks")
      .select("id, spotify_track_id, spotify_link_id, apple_music_id, isrc")
      .eq("id", trackId)
      .maybeSingle()
    if (!track) return jsonResponse({ error: "song not found" }, 404)

    const placeholder = /^(tidal_|apple:|yt:|share:)/.test(track.spotify_track_id || "")
    const spotifyId: string | null = placeholder ? track.spotify_link_id : track.spotify_track_id
    const appleFromPlaceholder = track.spotify_track_id?.startsWith("apple:") ? track.spotify_track_id.slice(6) : null
    let isrc: string | null = track.isrc
    const d: Details = { sources: [] }

    // Spotify first when there's no ISRC yet (it gives us one)
    let sp: Awaited<ReturnType<typeof fetchSpotify>> = null
    if (spotifyId && !isrc) {
      sp = await fetchSpotify(spotifyId)
      if (sp?.isrc) isrc = sp.isrc
    }

    const apple = await fetchApple(track.apple_music_id || appleFromPlaceholder, isrc)
    if (apple) {
      const a = apple.a
      d.releaseDate = a.releaseDate || null
      d.durationMs = a.durationInMillis || null
      d.genre = (a.genreNames || []).find((g: string) => g !== "Music") || null
      d.explicit = a.contentRating === "explicit"
      d.previewUrl = a.previews?.[0]?.url || null
      d.label = apple.album.recordLabel || null
      d.copyright = apple.album.copyright || null
      if (a.composerName) d.writers = uniq(String(a.composerName).split(/\s*(?:,|&)\s*/))
      if (!isrc && a.isrc) isrc = a.isrc
      d.sources!.push("Apple Music")
    }

    if ((!d.releaseDate || !d.durationMs || !d.label) && spotifyId) {
      sp = sp || (await fetchSpotify(spotifyId))
      if (sp) {
        d.releaseDate = d.releaseDate || sp.releaseDate
        d.durationMs = d.durationMs || sp.durationMs
        d.label = d.label || sp.label
        if (d.explicit === undefined) d.explicit = sp.explicit
        d.sources!.push("Spotify")
      }
    }

    let creditsComplete = true
    if (isrc) {
      const mb = await fetchMusicBrainz(isrc)
      creditsComplete = mb.ok
      if (mb.credits.length > 0) {
        d.credits = mb.credits
        if (mb.writers.length) d.writers = uniq([...(d.writers || []), ...mb.writers])
        if (mb.producers.length) d.producers = mb.producers
        d.sources!.push("MusicBrainz")
      }
    }

    // Save anything we learned about the song itself
    const trackUpdate: Record<string, string> = {}
    if (isrc && !track.isrc) trackUpdate.isrc = isrc
    if (apple?.id && !track.apple_music_id) trackUpdate.apple_music_id = apple.id
    if (Object.keys(trackUpdate).length) await admin.from("tracks").update(trackUpdate).eq("id", trackId)

    await admin.from("track_details").upsert({
      track_id: trackId,
      data: d,
      credits_complete: creditsComplete,
      fetched_at: new Date().toISOString(),
    })

    return jsonResponse({ details: d, cached: false })
  } catch (err) {
    console.error("track-details failed", err)
    return jsonResponse({ error: "couldn't load song details" }, 500)
  }
})
