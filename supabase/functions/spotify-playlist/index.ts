import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { requireCaller, jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { getSpotifyAppToken } from "../_shared/spotify.ts"
import { resolveTrackLinks } from "../_shared/links.ts"

// Spotify without connecting Spotify: sync a PUBLIC Spotify playlist as someone's collection.
// For people Spotify won't let connect (PLAI's Spotify app is in development mode, which only
// allows a short list of accounts). Reads with PLAI's own Spotify access; if Spotify refuses a
// playlist there, falls back to the playlist's public embed widget.
//
// Body: { action: "preview" | "connect" | "sync" | "disconnect", url?: string }
// The background job (sync-all) calls it as a trusted server call with just { user_id } → sync.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const MAX_TRACKS = 500
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

type PlaylistTrack = {
  id: string
  name: string
  artists: string
  album: string | null
  art: string | null
  isrc: string | null
  previewUrl: string | null
  addedAt: string | null
}
type Playlist = { id: string; name: string; owner: string | null; image: string | null; total: number; tracks: PlaylistTrack[]; via: "api" | "embed" }

const playlistIdFrom = (input: string): string | null => {
  const s = String(input || "").trim()
  const m = s.match(/playlist[/:]([A-Za-z0-9]{22})/) || s.match(/^([A-Za-z0-9]{22})$/)
  return m ? m[1] : null
}

async function readViaApi(id: string, token: string): Promise<Playlist | null> {
  const headers = { Authorization: `Bearer ${token}` }
  const meta = await fetch(
    `https://api.spotify.com/v1/playlists/${id}?market=US&fields=name,public,owner(display_name),images,tracks(total)`,
    { headers },
  )
  if (!meta.ok) return null
  const m = await meta.json()
  const tracks: PlaylistTrack[] = []
  let next: string | null =
    `https://api.spotify.com/v1/playlists/${id}/tracks?market=US&limit=100&fields=next,items(added_at,track(id,name,type,is_local,preview_url,artists(name),album(name,images),external_ids))`
  let pages = 0
  while (next && pages < 20) {
    const res = await fetch(next, { headers })
    if (!res.ok) break
    const d = await res.json()
    for (const it of d.items || []) {
      const t = it.track
      if (!t?.id || t.is_local || t.type !== "track") continue
      tracks.push({
        id: t.id,
        name: t.name,
        artists: (t.artists || []).map((a: { name: string }) => a.name).join(", "),
        album: t.album?.name || null,
        art: t.album?.images?.[0]?.url || null,
        isrc: t.external_ids?.isrc || null,
        previewUrl: t.preview_url || null,
        addedAt: it.added_at || null,
      })
    }
    next = d.next
    pages++
  }
  if (tracks.length === 0 && (m.tracks?.total ?? 0) > 0) return null // items blocked: try the embed
  return { id, name: m.name, owner: m.owner?.display_name || null, image: m.images?.[0]?.url || null, total: m.tracks?.total ?? tracks.length, tracks, via: "api" }
}

async function readViaEmbed(id: string, token: string | null): Promise<Playlist | null> {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PLAI/1.0; +https://plai.delaneyprojects.xyz)" },
  })
  if (!res.ok) return null
  const html = await res.text()
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1]
  if (!json) return null
  const entity = JSON.parse(json)?.props?.pageProps?.state?.data?.entity
  if (!entity) return null
  const ids: string[] = (entity.trackList || [])
    .map((t: { uri?: string }) => (t.uri || "").match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1])
    .filter(Boolean)

  // Full details (album, art, ISRC) from Spotify's song lookup, 50 at a time
  const byId = new Map<string, PlaylistTrack>()
  if (token) {
    for (const group of chunk(ids, 50)) {
      const r = await fetch(`https://api.spotify.com/v1/tracks?market=US&ids=${group.join(",")}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) continue
      for (const t of (await r.json()).tracks || []) {
        if (!t?.id) continue
        byId.set(t.id, {
          id: t.id,
          name: t.name,
          artists: (t.artists || []).map((a: { name: string }) => a.name).join(", "),
          album: t.album?.name || null,
          art: t.album?.images?.[0]?.url || null,
          isrc: t.external_ids?.isrc || null,
          previewUrl: t.preview_url || null,
          addedAt: null,
        })
      }
    }
  }
  const tracks: PlaylistTrack[] = (entity.trackList || [])
    .map((t: { uri?: string; title?: string; subtitle?: string }) => {
      const tid = (t.uri || "").match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1]
      if (!tid) return null
      return byId.get(tid) || { id: tid, name: t.title || "Unknown", artists: t.subtitle || "Unknown", album: null, art: null, isrc: null, previewUrl: null, addedAt: null }
    })
    .filter(Boolean)
  return {
    id,
    name: entity.name || entity.title || "Spotify playlist",
    owner: entity.subtitle || null,
    image: entity.coverArt?.sources?.[0]?.url || entity.images?.items?.[0]?.sources?.[0]?.url || null,
    total: tracks.length,
    tracks,
    via: "embed",
  }
}

async function readPlaylist(id: string): Promise<Playlist | null> {
  const token = await getSpotifyAppToken()
  const viaApi = token ? await readViaApi(id, token).catch(() => null) : null
  return viaApi || (await readViaEmbed(id, token).catch(() => null))
}

async function syncPlaylist(admin: SupabaseClient, userId: string, playlist: Playlist) {
  const tracks = playlist.tracks.slice(-MAX_TRACKS) // playlists list oldest first: keep the newest

  // Songs (same shape as the Spotify Liked Songs sync)
  const trackIdBySpotifyId = new Map<string, string>()
  const unique = [...new Map(tracks.map((t) => [t.id, t])).values()]
  for (const batch of chunk(unique, 100)) {
    const { data, error } = await admin
      .from("tracks")
      .upsert(
        batch.map((t) => ({
          spotify_track_id: t.id,
          title: t.name,
          artist: t.artists,
          album: t.album,
          album_art_url: t.art,
          preview_url: t.previewUrl,
          isrc: t.isrc,
        })),
        { onConflict: "spotify_track_id" },
      )
      .select("id, spotify_track_id")
    if (error) {
      console.error("playlist track upsert failed", error.message)
      continue
    }
    for (const row of data || []) trackIdBySpotifyId.set(row.spotify_track_id, row.id)
  }

  // Likes: songs the person removed from their collection stay removed; existing likes keep their date
  const { data: excluded } = await admin.from("collection_exclusions").select("track_id").eq("user_id", userId)
  const excludedIds = new Set(((excluded || []) as { track_id: string }[]).map((r) => r.track_id))
  const now = new Date().toISOString()
  const likeRows = tracks
    .map((t) => ({ trackId: trackIdBySpotifyId.get(t.id), likedAt: t.addedAt || now }))
    .filter((r): r is { trackId: string; likedAt: string } => !!r.trackId && !excludedIds.has(r.trackId))
  const seen = new Set<string>()
  const rows = likeRows
    .filter((r) => (seen.has(r.trackId) ? false : (seen.add(r.trackId), true)))
    .map((r) => ({ user_id: userId, track_id: r.trackId, liked_at: r.likedAt }))
  for (const group of chunk(rows, 200)) {
    const { error } = await admin.from("likes").upsert(group, { onConflict: "user_id,track_id", ignoreDuplicates: true })
    if (error) throw error
  }

  await admin
    .from("profiles")
    .update({ spotify_playlist_name: playlist.name, spotify_playlist_synced_at: now, last_synced_at: now })
    .eq("id", userId)

  // Apple Music / Tidal links in the background
  EdgeRuntime.waitUntil(resolveTrackLinks(admin, rows.map((r) => r.track_id), { spotifyLimit: 0 }).catch(() => {}))
  return rows.length
}

const summary = (p: Playlist) => ({ id: p.id, name: p.name, owner: p.owner, image: p.image, songs: p.tracks.length, total: p.total })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const caller = await requireCaller(req, admin, body.user_id)
    if (!caller.ok) return caller.response
    const userId = caller.userId
    const action: string = body.action || "sync"

    if (action === "disconnect") {
      await admin.from("profiles").update({ spotify_playlist_id: null, spotify_playlist_name: null, spotify_playlist_synced_at: null }).eq("id", userId)
      return jsonResponse({ success: true })
    }

    let playlistId: string | null
    if (action === "preview" || action === "connect") {
      playlistId = playlistIdFrom(body.url)
      if (!playlistId) return jsonResponse({ error: "that isn't a Spotify playlist link — in Spotify, open the playlist, tap ⋯ → Share → Copy link" }, 400)
    } else {
      const { data: profile } = await admin.from("profiles").select("spotify_playlist_id").eq("id", userId).single()
      playlistId = profile?.spotify_playlist_id || null
      if (!playlistId) return jsonResponse({ skipped: true, reason: "no playlist set" })
    }

    const playlist = await readPlaylist(playlistId)
    if (!playlist) {
      return jsonResponse({ error: "couldn't read that playlist — make sure it's public (in Spotify: ⋯ → Make public / Add to profile)" }, 404)
    }
    if (playlist.tracks.length === 0) return jsonResponse({ error: "that playlist has no songs PLAI can read" }, 422)

    if (action === "preview") return jsonResponse({ playlist: summary(playlist), via: playlist.via })

    if (action === "connect") {
      await admin.from("profiles").update({ spotify_playlist_id: playlist.id, spotify_playlist_name: playlist.name }).eq("id", userId)
    }
    const count = await syncPlaylist(admin, userId, playlist)
    return jsonResponse({ success: true, count, playlist: summary(playlist), via: playlist.via })
  } catch (err) {
    console.error("spotify-playlist failed", err)
    return jsonResponse({ error: "playlist sync failed — try again" }, 500)
  }
})
