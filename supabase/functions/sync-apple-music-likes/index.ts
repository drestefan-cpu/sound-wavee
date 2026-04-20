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

type TrackToUpsert = {
  catalogId: string
  title: string
  artist: string
  album: string | null
  albumArtUrl: string | null
  likedAt: string
}

type RecentAlbum = {
  libraryId: string
  dateAdded: string
  artwork: any
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("apple_music_user_token")
      .eq("id", user_id)
      .single()

    if (!profile?.apple_music_user_token) {
      return new Response(JSON.stringify({ error: "No Apple Music token found" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const developerToken = await generateDeveloperToken()
    const userToken = profile.apple_music_user_token

    const { data: exclusionRows } = await supabaseAdmin
      .from("collection_exclusions")
      .select("track_id")
      .eq("user_id", user_id)

    const excludedTrackIds = new Set((exclusionRows || []).map((row: any) => row.track_id))

    const { error: cleanupError } = await supabaseAdmin
      .rpc("delete_apple_music_likes", { p_user_id: user_id })
    if (cleanupError) console.error("Apple Music cleanup failed:", cleanupError.message)

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const authHeaders = {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": userToken,
    }

    const tracksToUpsert: TrackToUpsert[] = []
    const recentAlbums: RecentAlbum[] = []

    let nextUrl: string | null = "https://api.music.apple.com/v1/me/library/recently-added?limit=25"
    let stopFetching = false
    let pageCount = 0
    const maxPages = 5
    let songLogCount = 0
    let albumLogCount = 0

    // Step 1 — collect recently added songs and albums
    while (nextUrl && !stopFetching && pageCount < maxPages) {
      const res = await fetch(nextUrl, { headers: authHeaders })

      if (res.status === 401) {
        await supabaseAdmin
          .from("profiles")
          .update({ apple_music_user_token: null })
          .eq("id", user_id)
        return new Response(JSON.stringify({ error: "Apple Music token expired — please reconnect" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (!res.ok) {
        const body = await res.text()
        return new Response(JSON.stringify({ error: "Apple Music API failed", detail: body }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const data = await res.json()
      const items: any[] = data.data || []
      pageCount++

      for (const item of items) {
        if (item.type === "library-songs") {
          if (songLogCount < 3) {
            console.log("SONG_ITEM", JSON.stringify({
              name: item.attributes?.name,
              dateAdded: item.attributes?.dateAdded,
              releaseDate: item.attributes?.releaseDate,
              catalogId: item.attributes?.playParams?.catalogId,
              type: item.type
            }))
            songLogCount++
          }

          const attrs = item.attributes
          if (!attrs) continue
          if (!attrs.playParams?.catalogId) continue
          if (attrs.playParams?.kind === "upload") continue
          if (!attrs.dateAdded) continue

          const d = new Date(attrs.dateAdded)
          if (isNaN(d.getTime()) || d.getFullYear() < 2000) continue
          if (d < sixtyDaysAgo) { stopFetching = true; break }

          tracksToUpsert.push({
            catalogId: attrs.playParams.catalogId,
            title: attrs.name,
            artist: attrs.artistName,
            album: attrs.albumName || null,
            albumArtUrl: attrs.artwork?.url?.replace("{w}", "500").replace("{h}", "500") ?? null,
            likedAt: attrs.dateAdded,
          })
        } else if (item.type === "library-albums") {
          if (albumLogCount < 3) {
            console.log("ALBUM_ITEM", JSON.stringify({
              name: item.attributes?.name,
              dateAdded: item.attributes?.dateAdded,
              releaseDate: item.attributes?.releaseDate,
              catalogId: item.attributes?.playParams?.catalogId,
              type: item.type
            }))
            albumLogCount++
          }

          const attrs = item.attributes
          if (!attrs) continue
          if (!attrs.dateAdded) continue

          const d = new Date(attrs.dateAdded)
          if (isNaN(d.getTime()) || d.getFullYear() < 2000) continue
          if (d < sixtyDaysAgo) { stopFetching = true; break }

          recentAlbums.push({
            libraryId: item.id,
            dateAdded: attrs.dateAdded,
            artwork: attrs.artwork,
          })
        }
      }

      nextUrl = data.next ? `https://api.music.apple.com${data.next}` : null
    }

    // Step 2 — fetch tracks for each recently added album
    for (const album of recentAlbums) {
      const tracksRes = await fetch(
        `https://api.music.apple.com/v1/me/library/albums/${album.libraryId}/tracks?limit=100`,
        { headers: authHeaders }
      )

      if (!tracksRes.ok) {
        console.error(`Album tracks fetch failed for ${album.libraryId}:`, tracksRes.status)
        continue
      }

      const tracksData = await tracksRes.json()
      const tracks: any[] = tracksData.data || []

      for (const track of tracks) {
        const attrs = track.attributes
        if (!attrs) continue
        if (!attrs.playParams?.catalogId) continue
        if (attrs.playParams?.kind === "upload") continue
        if (!attrs.name || !attrs.artistName) continue

        tracksToUpsert.push({
          catalogId: attrs.playParams.catalogId,
          title: attrs.name,
          artist: attrs.artistName,
          album: attrs.albumName || null,
          albumArtUrl: album.artwork?.url?.replace("{w}", "500").replace("{h}", "500") ?? null,
          likedAt: album.dateAdded,
        })
      }
    }

    // Deduplicate by catalogId — keep the entry with the most recent likedAt
    const deduped = new Map<string, TrackToUpsert>()
    for (const track of tracksToUpsert) {
      const existing = deduped.get(track.catalogId)
      if (!existing || new Date(track.likedAt) > new Date(existing.likedAt)) {
        deduped.set(track.catalogId, track)
      }
    }

    // Step 3 — upsert to Supabase
    let syncedCount = 0
    for (const track of deduped.values()) {
      const { data: trackData } = await supabaseAdmin
        .from("tracks")
        .upsert({
          spotify_track_id: `apple:${track.catalogId}`,
          apple_music_id: track.catalogId,
          title: track.title,
          artist: track.artist,
          album: track.album,
          album_art_url: track.albumArtUrl,
        }, { onConflict: "spotify_track_id" })
        .select("id")
        .single()

      if (!trackData?.id) continue

      if (excludedTrackIds.has(trackData.id)) {
        await supabaseAdmin
          .from("collection_exclusions")
          .delete()
          .eq("user_id", user_id)
          .eq("track_id", trackData.id)
        excludedTrackIds.delete(trackData.id)
      }

      await supabaseAdmin
        .from("likes")
        .upsert({
          user_id,
          track_id: trackData.id,
          liked_at: track.likedAt,
        }, { onConflict: "user_id,track_id" })

      syncedCount++
    }

    await supabaseAdmin
      .from("profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", user_id)

    return new Response(JSON.stringify({ success: true, count: syncedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
