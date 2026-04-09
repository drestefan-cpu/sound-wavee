import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "missing user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get YouTube token from profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("youtube_access_token")
      .eq("id", user_id)
      .single();

    if (profileErr || !profile?.youtube_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "no token" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = profile.youtube_access_token;
    let syncedCount = 0;
    let pageToken: string | undefined = undefined;

    // Paginate through all liked videos
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("myRating", "liked");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("videoCategoryId", "10");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const ytRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!ytRes.ok) {
        const errText = await ytRes.text();
        console.error("YouTube API error:", ytRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `YouTube API ${ytRes.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ytData = await ytRes.json();
      const items = ytData.items || [];

      for (const item of items) {
        // Filter to music category only
        if (item.snippet?.categoryId !== "10") continue;

        const videoId = item.id;
        const title = item.snippet.title;
        const artist = item.snippet.channelTitle;
        const albumArt =
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.default?.url ||
          null;
        const likedAt = item.snippet.publishedAt;

        // Upsert track
        const { data: track, error: trackErr } = await supabase
          .from("tracks")
          .upsert(
            {
              title,
              artist,
              album_art_url: albumArt,
              youtube_video_id: videoId,
              spotify_track_id: `yt:${videoId}`,
            },
            { onConflict: "youtube_video_id" }
          )
          .select("id")
          .single();

        if (trackErr || !track) {
          console.error("Track upsert error:", trackErr?.message, videoId);
          continue;
        }

        // Upsert like
        const { error: likeErr } = await supabase
          .from("likes")
          .upsert(
            {
              user_id,
              track_id: track.id,
              liked_at: likedAt,
            },
            { onConflict: "user_id,track_id" }
          );

        if (likeErr) {
          console.error("Like upsert error:", likeErr.message);
          continue;
        }

        syncedCount++;
      }

      pageToken = ytData.nextPageToken;
    } while (pageToken);

    // Update last_synced_at
    await supabase
      .from("profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", user_id);

    return new Response(
      JSON.stringify({ success: true, count: syncedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-youtube-likes error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
