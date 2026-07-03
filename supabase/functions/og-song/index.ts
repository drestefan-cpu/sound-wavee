import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SITE = "https://onplai.lovable.app"
const DEFAULT_IMAGE = `${SITE}/plai-icon.png`

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

function html(content: string): Response {
  return new Response(content, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  })
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function buildHtml(opts: {
  title: string
  description: string
  image: string
  url: string
}): string {
  const { title, description, image, url } = opts
  return `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:image" content="${escape(image)}" />
  <meta property="og:url" content="${escape(url)}" />
  <meta property="og:type" content="music.song" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(title)}" />
  <meta name="twitter:description" content="${escape(description)}" />
  <meta name="twitter:image" content="${escape(image)}" />
  <meta http-equiv="refresh" content="0;url=${escape(url)}" />
</head>
<body>
  <p>Redirecting to PLAI...</p>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "GET") return new Response("GET only", { status: 405, headers: corsHeaders })

  const trackId = new URL(req.url).searchParams.get("id")

  if (!trackId) {
    return html(buildHtml({
      title: "PLAI",
      description: "i love your taste",
      image: DEFAULT_IMAGE,
      url: SITE,
    }))
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  )

  const { data: track } = await supabase
    .from("tracks")
    .select("title, artist, album, album_art_url")
    .eq("id", trackId)
    .maybeSingle()

  if (!track) {
    return html(buildHtml({
      title: "PLAI",
      description: "i love your taste",
      image: DEFAULT_IMAGE,
      url: `${SITE}/song/${trackId}`,
    }))
  }

  return html(buildHtml({
    title: `${track.title} — ${track.artist}`,
    description: `${track.artist} on PLAI`,
    image: track.album_art_url || DEFAULT_IMAGE,
    url: `${SITE}/song/${trackId}`,
  }))
})
