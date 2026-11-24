import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { requireCaller } from "../_shared/auth.ts"
import { resolveTrackLinks } from "../_shared/links.ts"

// Syncs a user's TIDAL favourite tracks using the current TIDAL API (v2, JSON:API):
//   1. GET /userCollectionTracks/me/relationships/items  → track ids + addedAt (newest first)
//   2. GET /tracks?filter[id]=…&include=artists,albums   → title, ISRC, artist names, album ids
//   3. GET /albums?filter[id]=…&include=coverArt         → album title + cover art URL
// Spec: https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const API = "https://openapi.tidal.com/v2"
const COUNTRY = "US"
const LOOKBACK_DAYS = 365
const MAX_PAGES = 15
const BATCH = 20 // TIDAL's filter[id] limit
const MIN_REQUEST_GAP_MS = 600 // pace requests to stay under TIDAL's rate limit
const MAX_429_RETRIES = 4

type Favourite = { id: string; addedAt: string }
type TrackInfo = { id: string; title: string; isrc: string | null; artist: string; album: string | null; albumArtUrl: string | null }

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
      .select("tidal_access_token, tidal_refresh_token")
      .eq("id", user_id)
      .single()

    if (!profile?.tidal_access_token) return json({ error: "No Tidal token" }, 401)

    let accessToken: string = profile.tidal_access_token

    // ── Token refresh (TIDAL access tokens are short-lived) ──────────────────
    let refreshAttempted = false
    const refreshAccessToken = async (): Promise<boolean> => {
      if (refreshAttempted || !profile.tidal_refresh_token) return false
      refreshAttempted = true
      const clientId = Deno.env.get("TIDAL_CLIENT_ID")!
      const clientSecret = Deno.env.get("TIDAL_CLIENT_SECRET")!
      const res = await fetch("https://auth.tidal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.tidal_refresh_token,
          client_id: clientId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.access_token) {
        console.error("Tidal token refresh failed:", res.status, data.error, data.error_description)
        return false
      }
      accessToken = data.access_token
      await supabaseAdmin.from("profiles").update({
        tidal_access_token: accessToken,
        ...(data.refresh_token ? { tidal_refresh_token: data.refresh_token } : {}),
      }).eq("id", user_id)
      return true
    }

    class TokenRejected extends Error {}
    class RateLimited extends Error {}

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    let lastRequestAt = 0

    // TIDAL rate-limits aggressively (HTTP 429). Space requests out, and on 429 wait
    // (honouring Retry-After) and retry a few times before giving up.
    const tidalGet = async (url: string): Promise<any> => {
      const doFetch = async () => {
        const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt)
        if (wait > 0) await sleep(wait)
        lastRequestAt = Date.now()
        return fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.api+json" } })
      }
      let res = await doFetch()
      for (let attempt = 1; res.status === 429 && attempt <= MAX_429_RETRIES; attempt++) {
        const retryAfter = Number(res.headers.get("Retry-After"))
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : Math.min(1500 * 2 ** (attempt - 1), 15_000)
        await sleep(delayMs)
        res = await doFetch()
      }
      if (res.status === 429) throw new RateLimited(`Tidal rate limit for ${url.replace(API, "")}`)
      if (res.status === 401 && await refreshAccessToken()) res = await doFetch()
      if (res.status === 401 || res.status === 403) throw new TokenRejected(`Tidal rejected token (${res.status})`)
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`Tidal API ${res.status} for ${url.replace(API, "")}: ${detail.slice(0, 300)}`)
      }
      return res.json()
    }

    const buildUrl = (path: string, params: Record<string, string | string[]>) => {
      const u = new URL(`${API}${path}`)
      for (const [k, v] of Object.entries(params)) {
        for (const value of Array.isArray(v) ? v : [v]) u.searchParams.append(k, value)
      }
      return u.toString()
    }

    try {
      // ── Step 1: favourite track ids, newest first ───────────────────────────
      const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
      const favourites: Favourite[] = []
      let nextUrl: string | null = buildUrl("/userCollectionTracks/me/relationships/items", {
        sort: "-addedAt",
        locale: "en-US",
      })
      let pages = 0
      let reachedCutoff = false
      // Lightweight sync stats returned to the caller (no personal data) — useful when debugging
      let itemsSeen = 0
      let oldestSeen: string | null = null
      const typesSeen = new Set<string>()

      let rateLimitedEarly = false
      while (nextUrl && !reachedCutoff && pages < MAX_PAGES) {
        let page: any
        try {
          page = await tidalGet(nextUrl)
        } catch (err) {
          // Still rate-limited after retries: keep the favourites collected so far.
          // The next sync picks up the rest (likes are upserted, so nothing duplicates).
          if (err instanceof RateLimited && favourites.length > 0) { rateLimitedEarly = true; break }
          throw err
        }
        pages++
        for (const item of (page.data || []) as any[]) {
          itemsSeen++
          if (item.type) typesSeen.add(String(item.type))
          if (item.meta?.addedAt) oldestSeen = item.meta.addedAt
          if (item.type !== "tracks" || !item.id) continue
          const addedAt: string = item.meta?.addedAt || new Date().toISOString()
          if (new Date(addedAt) < cutoff) { reachedCutoff = true; break }
          favourites.push({ id: String(item.id), addedAt })
        }
        const next: string | undefined = page.links?.next
        nextUrl = next ? (next.startsWith("http") ? next : `${API}${next}`) : null
      }

      if (favourites.length === 0) {

        await supabaseAdmin.from("profiles").update({ last_synced_at: new Date().toISOString() }).eq("id", user_id)
        return json({ success: true, count: 0, stats: { pages, itemsSeen, typesSeen: [...typesSeen], oldestSeen, reachedCutoff } })
      }

      // ── Step 2: track details (title, ISRC, artists, album id) ──────────────
      const trackInfo = new Map<string, TrackInfo>()
      const albumIdByTrackId = new Map<string, string>()

      for (const ids of chunk(favourites.map((f) => f.id), BATCH)) {
        let doc: any
        try {
          doc = await tidalGet(buildUrl("/tracks", {
            "filter[id]": ids,
            include: ["artists", "albums"],
            countryCode: COUNTRY,
          }))
        } catch (err) {
          // Rate-limited: save what we have; the next sync fills in the rest
          if (err instanceof RateLimited && trackInfo.size > 0) { rateLimitedEarly = true; break }
          throw err
        }
        const included = new Map<string, any>()
        for (const inc of (doc.included || []) as any[]) included.set(`${inc.type}:${inc.id}`, inc)

        for (const t of (doc.data || []) as any[]) {
          const artistNames = ((t.relationships?.artists?.data || []) as any[])
            .map((a) => included.get(`artists:${a.id}`)?.attributes?.name)
            .filter(Boolean)
          const albumRef = t.relationships?.albums?.data?.[0]
          const album = albumRef ? included.get(`albums:${albumRef.id}`) : null
          if (albumRef?.id) albumIdByTrackId.set(String(t.id), String(albumRef.id))
          const baseTitle: string = t.attributes?.title || "Unknown"
          const version: string | undefined = t.attributes?.version
          trackInfo.set(String(t.id), {
            id: String(t.id),
            title: version ? `${baseTitle} (${version})` : baseTitle,
            isrc: t.attributes?.isrc || null,
            artist: artistNames.join(", ") || "Unknown",
            album: album?.attributes?.title || null,
            albumArtUrl: null,
          })
        }
      }

      // ── Step 3: album cover art ─────────────────────────────────────────────
      const albumIds = [...new Set(albumIdByTrackId.values())]
      const coverByAlbumId = new Map<string, string>()
      for (const ids of chunk(albumIds, BATCH)) {
        try {
          const doc = await tidalGet(buildUrl("/albums", { "filter[id]": ids, include: ["coverArt"], countryCode: COUNTRY }))
          const artworks = new Map<string, any>()
          for (const inc of (doc.included || []) as any[]) if (inc.type === "artworks") artworks.set(String(inc.id), inc)
          for (const al of (doc.data || []) as any[]) {
            const artId = al.relationships?.coverArt?.data?.[0]?.id
            const files: any[] = artId ? artworks.get(String(artId))?.attributes?.files || [] : []
            // Pick the file closest to 640px wide
            const best = files
              .filter((f) => f?.href)
              .sort((a, b) => Math.abs((a.meta?.width ?? 640) - 640) - Math.abs((b.meta?.width ?? 640) - 640))[0]
            if (best) coverByAlbumId.set(String(al.id), best.href)
          }
        } catch (err) {
          if (err instanceof TokenRejected) throw err
          console.error("Tidal album art fetch failed (continuing without art):", String(err))
          if (err instanceof RateLimited) { rateLimitedEarly = true; break } // stop hammering; art fills in later
        }
      }
      for (const [trackId, albumId] of albumIdByTrackId) {
        const info = trackInfo.get(trackId)
        if (info) info.albumArtUrl = coverByAlbumId.get(albumId) || null
      }

      // ── Step 4: match against tracks PLAI already has (Tidal id, then ISRC) ──
      const trackIdByTidalId = new Map<string, string>()
      const tidalIds = [...trackInfo.keys()]

      for (const ids of chunk(tidalIds, 100)) {
        const { data, error } = await supabaseAdmin.from("tracks").select("id, tidal_track_id").in("tidal_track_id", ids)
        if (error) throw error
        for (const row of data || []) trackIdByTidalId.set(row.tidal_track_id, row.id)
      }

      const needIsrc = [...trackInfo.values()].filter((t) => !trackIdByTidalId.has(t.id) && t.isrc)
      const isrcRows = new Map<string, { id: string; tidal_track_id: string | null }>()
      for (const isrcs of chunk([...new Set(needIsrc.map((t) => t.isrc!))], 100)) {
        const { data, error } = await supabaseAdmin.from("tracks").select("id, isrc, tidal_track_id").in("isrc", isrcs)
        if (error) throw error
        for (const row of data || []) {
          const current = isrcRows.get(row.isrc)
          if (!current || (current.tidal_track_id && !row.tidal_track_id)) isrcRows.set(row.isrc, row)
        }
      }
      for (const t of needIsrc) {
        const row = isrcRows.get(t.isrc!)
        if (!row) continue
        trackIdByTidalId.set(t.id, row.id)
        if (!row.tidal_track_id) {
          await supabaseAdmin.from("tracks").update({ tidal_track_id: t.id }).eq("id", row.id)
          row.tidal_track_id = t.id
        }
      }

      // ── Step 5: insert tracks PLAI has never seen ───────────────────────────
      const toInsert = [...trackInfo.values()]
        .filter((t) => !trackIdByTidalId.has(t.id))
        .map((t) => ({
          spotify_track_id: `tidal_${t.id}`,
          tidal_track_id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          album_art_url: t.albumArtUrl,
          isrc: t.isrc,
          short_id: generateShortId(),
        }))

      for (const rows of chunk(toInsert, 100)) {
        const { data, error } = await supabaseAdmin
          .from("tracks")
          .upsert(rows, { onConflict: "spotify_track_id" })
          .select("id, tidal_track_id")
        if (!error) {
          for (const row of data || []) trackIdByTidalId.set(row.tidal_track_id, row.id)
          continue
        }
        console.error("Batch track insert failed, retrying individually:", error.message)
        for (const row of rows) {
          const { data: one, error: oneErr } = await supabaseAdmin
            .from("tracks")
            .upsert(row, { onConflict: "spotify_track_id" })
            .select("id, tidal_track_id")
            .single()
          if (oneErr) console.error(`Track insert failed for tidal_${row.tidal_track_id}:`, oneErr.message)
          else trackIdByTidalId.set(one.tidal_track_id, one.id)
        }
      }

      // ── Step 6: record likes (removed songs stay removed unless re-favourited) ─
      const likeByTrackId = new Map<string, string>()
      for (const f of favourites) {
        const trackId = trackIdByTidalId.get(f.id)
        if (!trackId) continue
        const existing = likeByTrackId.get(trackId)
        if (!existing || new Date(f.addedAt) > new Date(existing)) likeByTrackId.set(trackId, f.addedAt)
      }

      const { data: exclusionRows } = await supabaseAdmin
        .from("collection_exclusions")
        .select("track_id, created_at")
        .eq("user_id", user_id)
      const excludedAtByTrackId = new Map<string, string>(
        (exclusionRows || []).map((row: any) => [row.track_id, row.created_at])
      )

      const likedTrackIds: string[] = []
      const relikedTrackIds: string[] = []
      for (const [trackId, likedAt] of likeByTrackId) {
        const excludedAt = excludedAtByTrackId.get(trackId)
        if (!excludedAt) {
          likedTrackIds.push(trackId)
        } else if (new Date(likedAt) > new Date(excludedAt)) {
          likedTrackIds.push(trackId)
          relikedTrackIds.push(trackId)
        }
      }

      for (const ids of chunk(relikedTrackIds, 100)) {
        await supabaseAdmin.from("collection_exclusions").delete().eq("user_id", user_id).in("track_id", ids)
      }

      const likeRows = likedTrackIds.map((track_id) => ({ user_id, track_id, liked_at: likeByTrackId.get(track_id)! }))
      for (const rows of chunk(likeRows, 200)) {
        const { error } = await supabaseAdmin.from("likes").upsert(rows, { onConflict: "user_id,track_id" })
        if (error) throw error
      }

        // Find each song's Spotify and Apple Music IDs (by ISRC) so play/share buttons open the exact song everywhere
        let links = { checked: 0, spotifyFound: 0, appleFound: 0, tidalFound: 0 }
        try {
          links = await resolveTrackLinks(supabaseAdmin, likedTrackIds)
        } catch (err) {
          console.error("Link lookup failed (sync continues):", String(err))
        }
      await supabaseAdmin.from("profiles").update({ last_synced_at: new Date().toISOString() }).eq("id", user_id)

      return json({
        success: true,
        count: likeRows.length,
        links,
        stats: { pages, itemsSeen, favourites: favourites.length, withDetails: trackInfo.size, withArt: coverByAlbumId.size, oldestSeen, partial: rateLimitedEarly },
      })
    } catch (err) {
      if (err instanceof TokenRejected) {
        // Refresh failed or TIDAL revoked access: clear the token so Settings shows "connect" again
        await supabaseAdmin.from("profiles").update({ tidal_access_token: null }).eq("id", user_id)
        return json({ error: "Tidal connection expired — please reconnect in settings", reconnect: true }, 401)
      }
      throw err
    }
  } catch (err) {
    console.error("sync-tidal-likes error:", err)
    return json({ error: String((err as any)?.message ?? err) }, 500)
  }
})
