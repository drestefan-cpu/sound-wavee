import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { requireCaller } from "../_shared/auth.ts"
import { resolveTrackLinks } from "../_shared/links.ts"

// Syncs a user's Spotify Liked Songs from the last 12 months (same window as the other platforms).
// The first sync reads back to the 12-month cutoff (capped at MAX_PAGES × 50 songs). Later syncs
// stop as soon as they reach songs liked before the newest Spotify like already in PLAI.
// Writes are batched (one upsert per 100 tracks/likes) instead of 3–4 queries per song.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PAGE_SIZE = 50 // Spotify's maximum for /me/tracks
const MAX_PAGES = 10 // safety cap: up to 500 songs per sync
const LOOKBACK_DAYS = 365 // only import songs liked in the last 12 months
const CAUGHT_UP_MARGIN_MS = 24 * 60 * 60 * 1000 // re-check one day before the newest known like

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const generateShortId = () => Math.random().toString(36).slice(2, 8)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Only act on the signed-in caller's own account (see _shared/auth.ts)
    const caller = await requireCaller(req, supabaseAdmin, body.user_id)
    if (!caller.ok) return caller.response
    const user_id = caller.userId

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("spotify_access_token, spotify_refresh_token, spotify_backfilled_at")
      .eq("id", user_id)
      .single()

    if (!profile?.spotify_access_token) return json({ error: "No Spotify token found" }, 401)

    let accessToken: string = profile.spotify_access_token

    // ── Token refresh (Spotify access tokens last one hour) ──────────────────
    let refreshAttempted = false
    const refreshAccessToken = async (): Promise<boolean> => {
      if (refreshAttempted || !profile.spotify_refresh_token) return false
      refreshAttempted = true
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.spotify_refresh_token,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        }),
      })
      const refreshData = await refreshRes.json().catch(() => ({}))
      if (!refreshData.access_token) {
        console.error("Spotify token refresh failed:", refreshData.error, refreshData.error_description)
        return false
      }
      accessToken = refreshData.access_token
      await supabaseAdmin.from("profiles").update({
        spotify_access_token: accessToken,
        // Spotify sometimes rotates the refresh token
        ...(refreshData.refresh_token ? { spotify_refresh_token: refreshData.refresh_token } : {}),
      }).eq("id", user_id)
      return true
    }

    const spotifyGet = async (url: string): Promise<Response> => {
      let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.status === 401 && await refreshAccessToken()) {
        res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      }
      return res
    }

    // ── Where did the last sync get to? ─────────────────────────────────────
    // Newest like on a real Spotify track (not yt:/apple:/tidal_/share: rows)
    const { data: newestRows } = await supabaseAdmin
      .from("likes")
      .select("liked_at, tracks!inner(spotify_track_id)")
      .eq("user_id", user_id)
      .not("liked_at", "is", null)
      .not("tracks.spotify_track_id", "like", "yt:%")
      .not("tracks.spotify_track_id", "like", "apple:%")
      .not("tracks.spotify_track_id", "like", "tidal_%")
      .not("tracks.spotify_track_id", "like", "share:%")
      .order("liked_at", { ascending: false })
      .limit(1)
    const newestKnown = newestRows?.[0]?.liked_at ? new Date(newestRows[0].liked_at).getTime() : null
    // Until the full history has been read once (older versions only synced the newest 50),
    // don't stop early — read back as far as MAX_PAGES allows.
    const backfilled = !!profile.spotify_backfilled_at
    const caughtUpBefore = backfilled && newestKnown ? newestKnown - CAUGHT_UP_MARGIN_MS : null
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    let reachedCutoff = false

    // ── Step 1: read Liked Songs, newest first ──────────────────────────────
    const items: { track: any; addedAt: string }[] = []
    let nextUrl: string | null = `https://api.spotify.com/v1/me/tracks?limit=${PAGE_SIZE}`
    let pages = 0
    let caughtUp = false

    while (nextUrl && !caughtUp && !reachedCutoff && pages < MAX_PAGES) {
      const res = await spotifyGet(nextUrl)
      if (res.status === 401) return json({ error: "Spotify connection expired — please sign in again", reconnect: true }, 401)
      if (!res.ok) {
        if (items.length > 0) break // keep what we have; the next sync continues
        return json({ error: "Spotify API failed", status: res.status }, 502)
      }
      const data = await res.json()
      pages++
      for (const item of (data.items || []) as any[]) {
        if (!item.track?.id) continue
        // Liked Songs are newest first, so everything after this point is older than 12 months
        if (item.added_at && new Date(item.added_at).getTime() < cutoff) {
          reachedCutoff = true
          break
        }
        if (caughtUpBefore && item.added_at && new Date(item.added_at).getTime() < caughtUpBefore) {
          caughtUp = true
          break
        }
        items.push({ track: item.track, addedAt: item.added_at })
      }
      nextUrl = data.next || null
    }

    // ── Step 2: upsert tracks in batches ────────────────────────────────────
    const trackIdBySpotifyId = new Map<string, string>()
    const missingShortIds: string[] = []
    const uniqueTracks = [...new Map(items.map((i) => [i.track.id, i.track])).values()]

    for (const batch of chunk(uniqueTracks, 100)) {
      const rows = batch.map((t: any) => ({
        spotify_track_id: t.id,
        title: t.name,
        artist: t.artists?.map((a: any) => a.name).join(", "),
        album: t.album?.name,
        album_art_url: t.album?.images?.[0]?.url,
        preview_url: t.preview_url,
        isrc: t.external_ids?.isrc || null,
      }))
      // short_id is left out on purpose so existing share links keep their short codes
      const { data, error } = await supabaseAdmin
        .from("tracks")
        .upsert(rows, { onConflict: "spotify_track_id" })
        .select("id, spotify_track_id, short_id")
      if (error) {
        console.error("Spotify track batch upsert failed:", error.message)
        continue
      }
      for (const row of data || []) {
        trackIdBySpotifyId.set(row.spotify_track_id, row.id)
        if (!row.short_id) missingShortIds.push(row.id)
      }
    }

    // New tracks get a short share code
    for (const id of missingShortIds) {
      await supabaseAdmin.from("tracks").update({ short_id: generateShortId() }).eq("id", id).is("short_id", null)
    }

    // ── Step 3: likes (removed songs stay removed unless re-liked after removal) ──
    const { data: exclusionRows } = await supabaseAdmin
      .from("collection_exclusions")
      .select("track_id, created_at")
      .eq("user_id", user_id)
    const excludedAtByTrackId = new Map<string, string>(
      (exclusionRows || []).map((row: any) => [row.track_id, row.created_at])
    )

    const likeByTrackId = new Map<string, string>()
    for (const { track, addedAt } of items) {
      const trackId = trackIdBySpotifyId.get(track.id)
      if (trackId && !likeByTrackId.has(trackId)) likeByTrackId.set(trackId, addedAt)
    }

    const likeRows: { user_id: string; track_id: string; liked_at: string }[] = []
    const relikedTrackIds: string[] = []
    for (const [trackId, likedAt] of likeByTrackId) {
      const excludedAt = excludedAtByTrackId.get(trackId)
      if (excludedAt) {
        const relikedAfterRemoval = !!likedAt && new Date(likedAt) > new Date(excludedAt)
        if (!relikedAfterRemoval) continue
        relikedTrackIds.push(trackId)
      }
      likeRows.push({ user_id, track_id: trackId, liked_at: likedAt })
    }

    for (const ids of chunk(relikedTrackIds, 100)) {
      await supabaseAdmin.from("collection_exclusions").delete().eq("user_id", user_id).in("track_id", ids)
    }
    for (const rows of chunk(likeRows, 200)) {
      const { error } = await supabaseAdmin.from("likes").upsert(rows, { onConflict: "user_id,track_id" })
      if (error) throw error
    }

    // Find Apple Music IDs (by ISRC) so share pages show an exact Apple Music button too
    let links = { checked: 0, spotifyFound: 0, appleFound: 0 }
    try {
      links = await resolveTrackLinks(supabaseAdmin, likeRows.map((r) => r.track_id))
    } catch (err) {
      console.error("Link lookup failed (sync continues):", String(err))
    }

    const now = new Date().toISOString()
    // Mark the history as read once we've reached the end of Liked Songs (or the page cap)
    const reachedEnd = !nextUrl || reachedCutoff || pages >= MAX_PAGES
    await supabaseAdmin.from("profiles").update({
      last_synced_at: now,
      ...(!backfilled && reachedEnd ? { spotify_backfilled_at: now } : {}),
    }).eq("id", user_id)

    return json({ count: likeRows.length, success: true, stats: { pages, read: items.length, caughtUp, reachedCutoff, backfill: !backfilled, links } })
  } catch (err) {
    console.error("sync-spotify-likes error:", err)
    return json({ error: String((err as any)?.message ?? err) }, 500)
  }
})
