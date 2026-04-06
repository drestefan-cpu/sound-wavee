import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id");

    if (!profiles?.length) {
      return new Response(JSON.stringify({ message: "no users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const profile of profiles) {
      const userId = profile.id;

      // Get likes with track info
      const { data: likes } = await supabase
        .from("likes")
        .select("track_id, tracks(artist, title, spotify_track_id)")
        .eq("user_id", userId);

      // Get saved tracks
      const { data: saved } = await supabase
        .from("saved_tracks")
        .select("track_id, tracks(artist, title, spotify_track_id)")
        .eq("user_id", userId);

      // Get reactions
      const { data: reactions } = await supabase
        .from("reactions")
        .select("like_id, likes!reactions_like_id_fkey(track_id, tracks(artist, title))")
        .eq("user_id", userId);

      // Count artists
      const artistCount: Record<string, number> = {};
      const trackCount: Record<string, { count: number; title: string; artist: string; spotify_id: string }> = {};

      const allTracks = [
        ...(likes || []).map((l: any) => l.tracks),
        ...(saved || []).map((s: any) => s.tracks),
        ...(reactions || []).map((r: any) => r.likes?.tracks),
      ].filter(Boolean);

      for (const t of allTracks) {
        if (t.artist) {
          artistCount[t.artist] = (artistCount[t.artist] || 0) + 1;
        }
        const key = t.spotify_track_id || t.title;
        if (key) {
          if (!trackCount[key]) {
            trackCount[key] = { count: 0, title: t.title, artist: t.artist, spotify_id: t.spotify_track_id };
          }
          trackCount[key].count++;
        }
      }

      const topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      const topTracks = Object.values(trackCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const activityScore = (likes?.length || 0) + (saved?.length || 0) + (reactions?.length || 0);

      await supabase
        .from("taste_profiles")
        .upsert({
          user_id: userId,
          top_artists: topArtists,
          top_tracks: topTracks,
          activity_score: activityScore,
          last_calculated: new Date().toISOString(),
        }, { onConflict: "user_id" });

      results.push({ userId, topArtists: topArtists.length, activityScore });
    }

    // Calculate compatibility for follow pairs
    const { data: follows } = await supabase.from("follows").select("follower_id, following_id");

    if (follows?.length) {
      // Get all likes indexed by user
      const { data: allLikes } = await supabase.from("likes").select("user_id, track_id");
      const userLikes: Record<string, Set<string>> = {};
      for (const l of allLikes || []) {
        if (!userLikes[l.user_id]) userLikes[l.user_id] = new Set();
        userLikes[l.user_id].add(l.track_id);
      }

      const pairs = new Set<string>();
      const compatRecords: any[] = [];

      for (const f of follows) {
        const key = [f.follower_id, f.following_id].sort().join("|");
        if (pairs.has(key)) continue;
        pairs.add(key);

        const setA = userLikes[f.follower_id];
        const setB = userLikes[f.following_id];
        if (!setA || !setB) continue;

        let shared = 0;
        for (const t of setA) {
          if (setB.has(t)) shared++;
        }

        const avg = (setA.size + setB.size) / 2;
        const score = avg > 0 ? Math.round((shared / avg) * 100) : 0;

        const [user_a, user_b] = [f.follower_id, f.following_id].sort();
        compatRecords.push({
          user_a,
          user_b,
          score,
          calculated_at: new Date().toISOString(),
        });
      }

      if (compatRecords.length) {
        // Delete old and insert new
        for (const rec of compatRecords) {
          await supabase
            .from("taste_compatibility")
            .upsert(rec, { onConflict: "user_a,user_b" });
        }
      }
    }

    return new Response(JSON.stringify({ profiles: results.length, message: "done" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
