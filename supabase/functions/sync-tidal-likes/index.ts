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
      .select("tidal_access_token, tidal_refresh_token")
      .eq("id", user_id)
      .single()

    if (!profile?.tidal_access_token) {
      return new Response(JSON.stringify({ error: "No Tidal token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    let accessToken = profile.tidal_access_token

    let tidalRes = await fetch("https://openapi.tidal.com/v2/users/me/favorites/tracks?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.api+json" }
    })

    if (tidalRes.status === 401 && profile.tidal_refresh_token) {
      const clientId = Deno.env.get("TIDAL_CLIENT_ID") || ""
      const refreshRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.tidal_refresh_token,
          client_id: clientId,
        })
      })
      const refreshData = await refreshRes.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabaseAdmin.from("profiles").update({ tidal_access_token: accessToken }).eq("id", user_id)
        tidalRes = await fetch("https://openapi.tidal.com/v2/users/me/favorites/tracks?limit=50", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.api+json" }
        })
      }
    }

    if (!tidalRes.ok) {
      const errText = await tidalRes.text()
      return new Response(JSON.stringify({ error: "Tidal API failed", detail: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const tidalData = await tidalRes.json()
    let syncedCount = 0

    for (const item of tidalData.data || []) {
      const track = item.attributes
      if (!track) continue

      const { data: existing } = await supabaseAdmin
        .from("tracks")
        .select("id")
        .eq("tidal_track_id", item.id)
        .maybeSingle()

      let trackId: string
      if (existing) {
        trackId = existing.id
      } else {
        const { data: inserted } = await supabaseAdmin.from("tracks").insert({
          tidal_track_id: item.id,
          spotify_track_id: `tidal_${item.id}`,
          title: track.title || "Unknown",
          artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          album: track.album?.title || null,
          album_art_url: track.album?.imageCover?.[0]?.url || null,
        }).select("id").single()
        if (!inserted) continue
        trackId = inserted.id
      }

      const { data: existingLike } = await supabaseAdmin
        .from("likes")
        .select("id")
        .eq("user_id", user_id)
        .eq("track_id", trackId)
        .maybeSingle()

      if (!existingLike) {
        await supabaseAdmin.from("likes").insert({
          user_id,
          track_id: trackId,
          liked_at: track.dateAdded || new Date().toISOString(),
        })
      }
      syncedCount++
    }

    await supabaseAdmin.from("profiles").update({ last_synced_at: new Date().toISOString() }).eq("id", user_id)

    return new Response(JSON.stringify({ count: syncedCount, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
