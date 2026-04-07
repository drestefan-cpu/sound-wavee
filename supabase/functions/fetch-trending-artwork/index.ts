import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;

    // Get client credentials token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
      body: "grant_type=client_credentials",
    });
    const { access_token } = await tokenRes.json();

    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tracksRes = await fetch(`https://api.spotify.com/v1/tracks?ids=${ids.join(",")}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const tracksData = await tracksRes.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let updated = 0;
    for (const track of tracksData.tracks || []) {
      if (!track) continue;
      const artUrl = track.album?.images?.[0]?.url;
      if (!artUrl) continue;

      const { error } = await supabase.from("tracks").upsert({
        spotify_track_id: track.id,
        title: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: track.album?.name,
        album_art_url: artUrl,
      }, { onConflict: "spotify_track_id", ignoreDuplicates: false });

      if (!error) updated++;
    }

    return new Response(JSON.stringify({ updated, total: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
