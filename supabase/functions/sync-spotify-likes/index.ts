const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's Spotify tokens from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("spotify_access_token, spotify_refresh_token")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = profile.spotify_access_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No Spotify token found. User may need to re-authenticate.", count: 0 }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to fetch liked tracks
    const fetchLikedTracks = async (token: string) => {
      const res = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res;
    };

    let spotifyRes = await fetchLikedTracks(accessToken);

    // If 401, try refreshing the token
    if (spotifyRes.status === 401 && profile.spotify_refresh_token) {
      console.log("Access token expired, attempting refresh...");
      
      // Get Spotify client credentials from Supabase auth config
      // We need to use the refresh token to get a new access token
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.spotify_refresh_token,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        
        // Update the stored token
        const updateData: Record<string, string> = { spotify_access_token: accessToken };
        if (refreshData.refresh_token) {
          updateData.spotify_refresh_token = refreshData.refresh_token;
        }
        await supabaseAdmin.from("profiles").update(updateData).eq("id", user_id);
        
        // Retry the request
        spotifyRes = await fetchLikedTracks(accessToken);
      } else {
        const errText = await refreshRes.text();
        console.error("Token refresh failed:", errText);
        return new Response(JSON.stringify({ error: "Token refresh failed. User may need to re-authenticate.", count: 0 }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!spotifyRes.ok) {
      const errText = await spotifyRes.text();
      console.error("Spotify API error:", errText);
      return new Response(JSON.stringify({ error: "Spotify API error", details: errText, count: 0 }), {
        status: spotifyRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spotifyData = await spotifyRes.json();
    let syncedCount = 0;

    for (const item of spotifyData.items || []) {
      const track = item.track;
      if (!track) continue;

      // Upsert track
      const { data: trackData, error: trackError } = await supabaseAdmin
        .from("tracks")
        .upsert(
          {
            spotify_track_id: track.id,
            title: track.name,
            artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
            album: track.album?.name || null,
            album_art_url: track.album?.images?.[0]?.url || null,
            preview_url: track.preview_url || null,
          },
          { onConflict: "spotify_track_id" }
        )
        .select("id")
        .single();

      if (trackError || !trackData) {
        console.error("Track upsert error:", trackError);
        continue;
      }

      // Upsert like
      const { error: likeError } = await supabaseAdmin
        .from("likes")
        .upsert(
          {
            user_id,
            track_id: trackData.id,
            liked_at: item.added_at || new Date().toISOString(),
          },
          { onConflict: "user_id,track_id" }
        );

      if (likeError) {
        console.error("Like upsert error:", likeError);
      } else {
        syncedCount++;
      }
    }

    // Update last_synced_at
    await supabaseAdmin.from("profiles").update({ last_synced_at: new Date().toISOString() }).eq("id", user_id);

    return new Response(JSON.stringify({ count: syncedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: String(err), count: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
