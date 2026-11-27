import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { generateAppleDeveloperToken, getTidalAppToken } from "../_shared/links.ts"
import { getSpotifyAppToken } from "../_shared/spotify.ts"

/**
 * The release screen (from the artist section): cover, tracklist, length, label, a short note,
 * and the release on each music app. Body: { apple_album_id }.
 * Details come from Apple Music; the same release on Spotify / Tidal / Deezer is matched by its
 * barcode (UPC), with searches as the fallback. Cached for 7 days in album_details.
 */

const CACHE_DAYS = 7

async function getJson(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function spotifyAlbum(upc: string | null, title: string, artist: string): Promise<string | null> {
  const token = await getSpotifyAppToken()
  if (!token) return null
  const h = { Authorization: `Bearer ${token}` }
  if (upc) {
    const r = await getJson(`https://api.spotify.com/v1/search?type=album&limit=1&q=${encodeURIComponent(`upc:${upc}`)}`, h)
    const url = r?.albums?.items?.[0]?.external_urls?.spotify
    if (url) return url
  }
  const r = await getJson(
    `https://api.spotify.com/v1/search?type=album&limit=5&q=${encodeURIComponent(`album:${title} artist:${artist}`)}`,
    h,
  )
  const hit = ((r?.albums?.items || []) as any[]).find((a) => String(a.name).toLowerCase() === title.toLowerCase())
  return hit?.external_urls?.spotify || null
}

async function tidalAlbum(upc: string | null): Promise<string | null> {
  if (!upc) return null
  const token = await getTidalAppToken()
  if (!token) return null
  const r = await getJson(`https://openapi.tidal.com/v2/albums?countryCode=US&filter[barcodeId]=${encodeURIComponent(upc)}`, {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.api+json",
  })
  const id = r?.data?.[0]?.id
  return id ? `https://tidal.com/browse/album/${id}` : null
}

async function deezerAlbum(upc: string | null): Promise<string | null> {
  if (!upc) return null
  const r = await getJson(`https://api.deezer.com/album/upc:${encodeURIComponent(upc)}`)
  return r?.link || null
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { apple_album_id } = await req.json().catch(() => ({}))
    if (!apple_album_id || !/^\d{1,15}$/.test(String(apple_album_id))) return jsonResponse({ error: "apple_album_id required" }, 400)
    const id = String(apple_album_id)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const { data: cached } = await admin.from("album_details").select("data, fetched_at").eq("apple_album_id", id).maybeSingle()
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86_400_000) return jsonResponse(cached.data)

    const token = await generateAppleDeveloperToken()
    if (!token) return jsonResponse({ error: "apple music isn't configured" }, 500)
    const album = await getJson(`https://api.music.apple.com/v1/catalog/us/albums/${id}?include=tracks`, { Authorization: `Bearer ${token}` })
    const item = album?.data?.[0]
    const a = item?.attributes
    if (!a) return jsonResponse({ error: "release not found" }, 404)

    const title = String(a.name).replace(/ - (single|ep)$/i, "")
    const kind = a.isSingle || / - single$/i.test(a.name) ? "single" : / - ep$/i.test(a.name) ? "EP" : "album"
    const tracks = ((item.relationships?.tracks?.data || []) as any[])
      .map((t) => t.attributes)
      .filter(Boolean)
      .map((t) => ({
        n: t.trackNumber as number,
        disc: (t.discNumber as number) || 1,
        title: t.name as string,
        artist: t.artistName !== a.artistName ? (t.artistName as string) : null,
        ms: (t.durationInMillis as number) || 0,
        explicit: t.contentRating === "explicit",
      }))
    const totalMs = tracks.reduce((s, t) => s + t.ms, 0)
    const upc: string | null = a.upc || null
    const query = encodeURIComponent(`${title} ${a.artistName}`)

    const [spotify, tidal, deezer] = await Promise.all([
      spotifyAlbum(upc, title, a.artistName).catch(() => null),
      tidalAlbum(upc).catch(() => null),
      deezerAlbum(upc).catch(() => null),
    ])

    const details = {
      id,
      title,
      artist: a.artistName as string,
      kind,
      releaseDate: a.releaseDate || null,
      art: a.artwork?.url ? String(a.artwork.url).replace("{w}", "1000").replace("{h}", "1000") : null,
      label: a.recordLabel || null,
      copyright: a.copyright || null,
      note: a.editorialNotes?.short || null,
      tracks,
      totalMs,
      links: {
        apple_music: a.url || null,
        spotify: spotify || `https://open.spotify.com/search/${query}`,
        tidal: tidal || `https://tidal.com/search?q=${query}`,
        youtube_music: `https://music.youtube.com/search?q=${query}`,
        amazon_music: `https://music.amazon.com/search/${query}`,
        deezer,
      },
      exact: { spotify: !!spotify, tidal: !!tidal },
    }
    await admin.from("album_details").upsert({ apple_album_id: id, data: details, fetched_at: new Date().toISOString() })
    return jsonResponse(details)
  } catch (err) {
    console.error("album-details failed", err)
    return jsonResponse({ error: "couldn't load the release" }, 500)
  }
})
