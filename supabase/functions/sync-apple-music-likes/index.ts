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

    // Delete all existing Apple Music likes via server-side RPC — reliable single
    // SQL DELETE with a subquery, no JS-side array chaining or URL length limits.
    const { data: cleanedCount, error: cleanupError } = await supabaseAdmin
      .rpc("delete_apple_music_likes", { p_user_id: user_id })
    if (cleanupError) console.error("Apple Music cleanup failed:", cleanupError.message)
    else console.log(`Cleaned up ${cleanedCount} existing Apple Music likes`)

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    let syncedCount = 0
    let offset = 0
    const limit = 100

    while (true) {
      const res = await fetch(
        `https://api.music.apple.com/v1/me/library/songs?limit=${limit}&offset=${offset}&extend=dateAdded`,
        {
          headers: {
            Authorization: `Bearer ${developerToken}`,
            "Music-User-Token": userToken,
          },
        }
      )

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

      for (const item of items) {
        const attrs = item.attributes
        if (!attrs) continue

        // Skip uploaded/local files — Apple Music sets kind "uploadedAudio" for
        // user-uploaded tracks (local files, demos, etc). Catalog streaming tracks
        // have kind "song". Absence of playParams entirely also means local.
        // Skip local/uploaded files — catalog streaming tracks have a catalogId
        if (!attrs.playParams?.catalogId) continue

        // Skip tracks added more than 60 days ago
        // (API returns alphabetically, so we must scan all pages and filter client-side)
        if (attrs.dateAdded && new Date(attrs.dateAdded) < sixtyDaysAgo) continue

        const appleId: string = item.id
        const title: string = attrs.name
        const artist: string = attrs.artistName
        const album: string | null = attrs.albumName || null
        const albumArtUrl: string | null = attrs.artwork?.url
          ? attrs.artwork.url.replace("{w}", "500").replace("{h}", "500")
          : null
        const addedAt = attrs.dateAdded
        if (!addedAt) continue

        if (!title || !artist || !appleId) continue

        const { data: trackData } = await supabaseAdmin
          .from("tracks")
          .upsert({
            spotify_track_id: `apple:${appleId}`,
            apple_music_id: appleId,
            title,
            artist,
            album,
            album_art_url: albumArtUrl,
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
            liked_at: addedAt,
          }, { onConflict: "user_id,track_id" })

        syncedCount++
      }

      if (!data.next || items.length < limit) break
      offset += limit
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
