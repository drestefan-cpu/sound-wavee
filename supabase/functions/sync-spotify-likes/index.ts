import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { user_id } = await req.json()
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("spotify_access_token, spotify_refresh_token")
      .eq("id", user_id)
      .single()

    if (!profile?.spotify_access_token) {
      return new Response(JSON.stringify({ error: "No Spotify token found" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    let accessToken = profile.spotify_access_token

    let spotifyRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (spotifyRes.status === 401 && profile.spotify_refresh_token) {
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.spotify_refresh_token,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        })
      })
      const refreshData = await refreshRes.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabaseAdmin.from("profiles").update({ spotify_access_token: accessToken }).eq("id", user_id)
        spotifyRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      }
    }

    if (!spotifyRes.ok) {
      return new Response(JSON.stringify({ error: "Spotify API failed", status: spotifyRes.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const spotifyData = await spotifyRes.json()
    let syncedCount = 0

    const { data: exclusionRows } = await supabaseAdmin
      .from("collection_exclusions")
      .select("track_id")
      .eq("user_id", user_id)

    const excludedTrackIds = new Set((exclusionRows || []).map((row: any) => row.track_id))

    for (const item of spotifyData.items || []) {
      const track = item.track
      if (!track?.id) continue

      const { data: trackData } = await supabaseAdmin
        .from("tracks")
        .upsert({
          spotify_track_id: track.id,
          title: track.name,
          artist: track.artists?.map((a: any) => a.name).join(", "),
          album: track.album?.name,
          album_art_url: track.album?.images?.[0]?.url,
          preview_url: track.preview_url,
        }, { onConflict: "spotify_track_id" })
        .select("id")
        .single()

      if (!trackData?.id) continue

      if (excludedTrackIds.has(trackData.id)) continue

      await supabaseAdmin
        .from("likes")
        .upsert({
          user_id,
          track_id: trackData.id,
          liked_at: item.added_at,
        }, { onConflict: "user_id,track_id" })

      syncedCount++
    }

    await supabaseAdmin.from("profiles").update({ last_synced_at: new Date().toISOString() }).eq("id", user_id)

    return new Response(JSON.stringify({ count: syncedCount, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
