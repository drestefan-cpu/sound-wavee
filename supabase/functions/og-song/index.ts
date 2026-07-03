import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const trackId = url.searchParams.get("id")
  const from = url.searchParams.get("from")

  const defaultOG = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="PLAI" />
  <meta property="og:description" content="i love your taste" />
  <meta property="og:image" content="https://onplai.lovable.app/plai-icon.png" />
  <meta property="og:url" content="https://onplai.lovable.app" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="PLAI" />
  <meta name="twitter:description" content="i love your taste" />
  <meta name="twitter:image" content="https://onplai.lovable.app/plai-icon.png" />
  <meta http-equiv="refresh" content="0;url=https://onplai.lovable.app" />
</head>
<body><p>Redirecting to PLAI...</p></body>
</html>`

  if (!trackId) {
    return new Response(defaultOG, {
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    )

    const { data: track } = await supabase
      .from("tracks")
      .select("id, title, artist, album, album_art_url")
      .eq("id", trackId)
      .single()

    if (!track) {
      return new Response(defaultOG, {
        headers: { ...corsHeaders, "Content-Type": "text/html" }
      })
    }

    const songUrl = `https://onplai.lovable.app/song/${trackId}${from ? "?from=" + from : ""}`
    const image = track.album_art_url || "https://onplai.lovable.app/plai-icon.png"
    const title = `${track.title} — ${track.artist}`
    const description = track.album ? `${track.album} · on PLAI` : `${track.artist} on PLAI`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${songUrl}" />
  <meta property="og:type" content="music.song" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${songUrl}" />
</head>
<body><p>Redirecting to PLAI...</p></body>
</html>`

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    })

  } catch (err) {
    return new Response(defaultOG, {
      headers: { ...corsHeaders, "Content-Type": "text/html" }
    })
  }
})
