import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function generateDeveloperToken(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID")!
  const keyId = Deno.env.get("APPLE_KEY_ID")!
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")!

  const header = btoa(JSON.stringify({ alg: "ES256", kid: keyId }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ iss: teamId, iat: now, exp: now + 3600 }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const data = `${header}.${payload}`

  function pemToBuffer(pem: string) {
    const base64 = pem
      .replace(/\\n/g, "\n")
      .replace(/-----[^-]+-----/g, "")
      .replace(/\s/g, "")
    const binary = atob(base64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
    return buffer.buffer
  }

  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBuffer(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  )

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key, new TextEncoder().encode(data)
  )

  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`
}

// How far back to read the Apple library "recently added" list, and the page cap (25 items per page).
// Likes are never deleted by this function, so older songs stay in PLAI after they fall outside this window.
const LOOKBACK_DAYS = 180
const MAX_PAGES = 8

type TrackToUpsert = {
  catalogId: string
  title: string
  artist: string
  album: string | null
  albumArtUrl: string | null
  likedAt: string
  isrc: string | null
}

type RecentAlbum = {
  libraryId: string
  dateAdded: string
  artwork: any
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const generateShortId = () => Math.random().toString(36).slice(2, 8)

// Apple returns 401 or 403 when the Music-User-Token has expired or been revoked
const isTokenRejected = (status: number) => status === 401 || status === 403

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const { user_id } = await req.json()
    if (!user_id) return json({ error: "user_id required" }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("apple_music_user_token")
      .eq("id", user_id)
      .single()

    if (!profile?.apple_music_user_token) return json({ error: "No Apple Music token found" }, 401)

    const developerToken = await generateDeveloperToken()
    const authHeaders = {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": profile.apple_music_user_token,
    }

    const expireToken = async () => {
      await supabaseAdmin.from("profiles").update({ apple_music_user_token: null }).eq("id", user_id)
      return json({ error: "Apple Music connection expired — please reconnect in settings", reconnect: true }, 401)
    }

    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const tracksToUpsert: TrackToUpsert[] = []
    const recentAlbums: RecentAlbum[] = []

    // ── Step 1: read the library "recently added" list (newest first) ──────────
    // Nothing in the database is touched until Apple has answered successfully.
    let nextUrl: string | null = "https://api.music.apple.com/v1/me/library/recently-added?limit=25"
    let stopFetching = false
    let pageCount = 0

    while (nextUrl && !stopFetching && pageCount < MAX_PAGES) {
      const res = await fetch(nextUrl, { headers: authHeaders })
      if (isTokenRejected(res.status)) return await expireToken()
      if (!res.ok) {
        const detail = await res.text()
        console.error("Apple Music API failed:", res.status, detail.slice(0, 300))
        return json({ error: "Apple Music API failed", status: res.status }, 502)
      }

      const data = await res.json()
      const items: any[] = data.data || []
      pageCount++

      for (const item of items) {
        const attrs = item.attributes
        if (!attrs?.dateAdded) continue
        const added = new Date(attrs.dateAdded)
        if (isNaN(added.getTime()) || added.getFullYear() < 2000) continue
        if (added < cutoff) { stopFetching = true; break }

        if (item.type === "library-songs") {
          if (!attrs.playParams?.catalogId) continue
          if (attrs.playParams?.kind === "upload") continue
          tracksToUpsert.push({
            catalogId: attrs.playParams.catalogId,
            title: attrs.name,
            artist: attrs.artistName,
            album: attrs.albumName || null,
            albumArtUrl: attrs.artwork?.url?.replace("{w}", "500").replace("{h}", "500") ?? null,
            likedAt: attrs.dateAdded,
            isrc: attrs.isrc || null,
          })
        } else if (item.type === "library-albums") {
          recentAlbums.push({ libraryId: item.id, dateAdded: attrs.dateAdded, artwork: attrs.artwork })
        }
      }

      nextUrl = data.next ? `https://api.music.apple.com${data.next}` : null
    }

    // ── Step 2: expand recently added albums into their tracks ─────────────────
    for (const album of recentAlbums) {
      const tracksRes = await fetch(
        `https://api.music.apple.com/v1/me/library/albums/${album.libraryId}/tracks?limit=100`,
        { headers: authHeaders }
      )
      if (isTokenRejected(tracksRes.status)) return await expireToken()
      if (!tracksRes.ok) {
        console.error(`Album tracks fetch failed for ${album.libraryId}:`, tracksRes.status)
        continue
      }

      const tracksData = await tracksRes.json()
      for (const track of (tracksData.data || []) as any[]) {
        const attrs = track.attributes
        if (!attrs?.playParams?.catalogId) continue
        if (attrs.playParams?.kind === "upload") continue
        if (!attrs.name || !attrs.artistName) continue
        tracksToUpsert.push({
          catalogId: attrs.playParams.catalogId,
          title: attrs.name,
          artist: attrs.artistName,
          album: attrs.albumName || null,
          albumArtUrl: album.artwork?.url?.replace("{w}", "500").replace("{h}", "500") ?? null,
          likedAt: album.dateAdded,
          isrc: attrs.isrc || null,
        })
      }
    }

    // Deduplicate by catalogId — keep the entry with the most recent likedAt
    const deduped = new Map<string, TrackToUpsert>()
    for (const track of tracksToUpsert) {
      const existing = deduped.get(track.catalogId)
      if (!existing || new Date(track.likedAt) > new Date(existing.likedAt)) deduped.set(track.catalogId, track)
    }
    const appleTracks = [...deduped.values()]

    // ── Step 3: match against tracks PLAI already has ──────────────────────────
    // First by Apple ID, then by ISRC (so a song already synced from Spotify or a
    // share link is reused instead of creating a duplicate that the unique
    // apple_music_id index would reject).
    const trackIdByCatalogId = new Map<string, string>()

    for (const ids of chunk(appleTracks.map((t) => t.catalogId), 100)) {
      const { data, error } = await supabaseAdmin.from("tracks").select("id, apple_music_id").in("apple_music_id", ids)
      if (error) throw error
      for (const row of data || []) trackIdByCatalogId.set(row.apple_music_id, row.id)
    }

    const needIsrcMatch = appleTracks.filter((t) => !trackIdByCatalogId.has(t.catalogId) && t.isrc)
    const isrcRows = new Map<string, { id: string; apple_music_id: string | null }>()
    for (const isrcs of chunk([...new Set(needIsrcMatch.map((t) => t.isrc!))], 100)) {
      const { data, error } = await supabaseAdmin.from("tracks").select("id, isrc, apple_music_id").in("isrc", isrcs)
      if (error) throw error
      for (const row of data || []) {
        // Prefer a row that has no Apple ID yet, so we can attach this one to it
        const current = isrcRows.get(row.isrc)
        if (!current || (current.apple_music_id && !row.apple_music_id)) isrcRows.set(row.isrc, row)
      }
    }

    for (const t of needIsrcMatch) {
      const row = isrcRows.get(t.isrc!)
      if (!row) continue
      trackIdByCatalogId.set(t.catalogId, row.id)
      if (!row.apple_music_id) {
        // Attach the Apple ID to the existing row (ignore failure — the like still links to this row)
        const { error } = await supabaseAdmin.from("tracks").update({ apple_music_id: t.catalogId }).eq("id", row.id)
        if (!error) row.apple_music_id = t.catalogId
      }
    }

    // ── Step 4: insert tracks PLAI has never seen ───────────────────────────────
    const toInsert = appleTracks
      .filter((t) => !trackIdByCatalogId.has(t.catalogId))
      .map((t) => ({
        spotify_track_id: `apple:${t.catalogId}`,
        apple_music_id: t.catalogId,
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
        .select("id, apple_music_id")
      if (!error) {
        for (const row of data || []) trackIdByCatalogId.set(row.apple_music_id, row.id)
        continue
      }
      // A batch fails as a whole if one row conflicts — retry one by one so the rest still go in
      console.error("Batch track insert failed, retrying individually:", error.message)
      for (const row of rows) {
        const { data: one, error: oneErr } = await supabaseAdmin
          .from("tracks")
          .upsert(row, { onConflict: "spotify_track_id" })
          .select("id, apple_music_id")
          .single()
        if (oneErr) console.error(`Track insert failed for apple:${row.apple_music_id}:`, oneErr.message)
        else trackIdByCatalogId.set(one.apple_music_id, one.id)
      }
    }

    // ── Step 5: record the likes ────────────────────────────────────────────────
    // Two Apple catalog IDs can map to the same PLAI track, so dedupe by track_id
    const likeByTrackId = new Map<string, string>()
    for (const t of appleTracks) {
      const trackId = trackIdByCatalogId.get(t.catalogId)
      if (!trackId) continue
      const existing = likeByTrackId.get(trackId)
      if (!existing || new Date(t.likedAt) > new Date(existing)) likeByTrackId.set(trackId, t.likedAt)
    }
    // A song the user removed from their collection stays removed, unless it was
    // added to their Apple library again after the removal
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

    await supabaseAdmin
      .from("profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", user_id)

    return json({ success: true, count: likeRows.length })
  } catch (err) {
    console.error("sync-apple-music-likes error:", err)
    return json({ error: String((err as any)?.message ?? err) }, 500)
  }
})
