import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { user_id, track_id } = await req.json()
    if (!user_id || !track_id) {
      return new Response(JSON.stringify({ error: "user_id and track_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Look up Spotify track ID and user's Spotify token in parallel
    const [trackRes, profileRes] = await Promise.all([
      supabaseAdmin.from("tracks").select("spotify_track_id").eq("id", track_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("spotify_access_token, spotify_refresh_token, spotify_id, plai_playlist_id").eq("id", user_id).single(),
    ])

    const spotifyTrackId = trackRes.data?.spotify_track_id
    if (!spotifyTrackId) {
      // Track has no Spotify ID (Apple Music sourced etc.) — skip silently
      return new Response(JSON.stringify({ skipped: true, reason: "no_spotify_track_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!profileRes.data?.spotify_access_token) {
      // Non-Spotify user — skip silently
      return new Response(JSON.stringify({ skipped: true, reason: "no_spotify_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let accessToken = profileRes.data.spotify_access_token
    let playlistId = profileRes.data.plai_playlist_id

    // Helper: refresh Spotify token if a call returns 401
    const refreshToken = async (): Promise<boolean> => {
      const rt = profileRes.data?.spotify_refresh_token
      if (!rt) return false
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: rt,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        }),
      })
      const data = await res.json()
      if (!data.access_token) return false
      accessToken = data.access_token
      await supabaseAdmin.from("profiles").update({ spotify_access_token: accessToken }).eq("id", user_id)
      return true
    }

    // Helper: get the current Spotify user ID (needed to create playlist)
    const getSpotifyUserId = async (): Promise<string | null> => {
      if (profileRes.data?.spotify_id) return profileRes.data.spotify_id
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.id || null
    }

    // Helper: create the PLAI playlist and persist its ID
    const createPlaylist = async (): Promise<string | null> => {
      const spotifyUserId = await getSpotifyUserId()
      if (!spotifyUserId) return null

      let res = await fetch(`https://api.spotify.com/v1/users/${spotifyUserId}/playlists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "PLAI",
          description: "Songs saved from PLAI",
          public: false,
        }),
      })

      if (res.status === 401) {
        const refreshed = await refreshToken()
        if (!refreshed) return null
        res = await fetch(`https://api.spotify.com/v1/users/${spotifyUserId}/playlists`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "PLAI",
            description: "Songs saved from PLAI",
            public: false,
          }),
        })
      }

      if (res.status === 403) {
        return "scope_missing"
      }

      if (!res.ok) return null

      const data = await res.json()
      const newId = data.id
      if (!newId) return null

      await supabaseAdmin.from("profiles").update({ plai_playlist_id: newId }).eq("id", user_id)
      return newId
    }

    // Ensure we have a playlist ID
    if (!playlistId) {
      const result = await createPlaylist()
      if (result === "scope_missing") {
        return new Response(JSON.stringify({ error: "scope_missing" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (!result) {
        return new Response(JSON.stringify({ error: "could not create playlist" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      playlistId = result
    }

    // Add track to the playlist
    let addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
    })

    if (addRes.status === 401) {
      const refreshed = await refreshToken()
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "token refresh failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
      })
    }

    if (addRes.status === 403) {
      return new Response(JSON.stringify({ error: "scope_missing" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!addRes.ok) {
      const body = await addRes.text()
      return new Response(JSON.stringify({ error: "spotify add failed", detail: body }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
