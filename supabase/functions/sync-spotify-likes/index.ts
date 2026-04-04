import { corsHeaders } from "@supabase/supabase-js/cors";
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

    // Get user's Spotify access token from auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerToken = user.user_metadata?.provider_token;
    
    // Try to get token from identities
    const spotifyIdentity = user.identities?.find((i: any) => i.provider === "spotify");
    const accessToken = providerToken || spotifyIdentity?.identity_data?.provider_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No Spotify token found. User may need to re-authenticate." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch liked tracks from Spotify
    const spotifyRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!spotifyRes.ok) {
      const errText = await spotifyRes.text();
      return new Response(JSON.stringify({ error: "Spotify API error", details: errText }), {
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

      if (trackError || !trackData) continue;

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

      if (!likeError) syncedCount++;
    }

    return new Response(JSON.stringify({ count: syncedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
