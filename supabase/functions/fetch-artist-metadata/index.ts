import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const err = (msg: string) =>
  new Response(JSON.stringify({ success: false, error: msg }), {
    status: 200, // always 200 — caller checks success flag
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// ── Platform detection ────────────────────────────────────────────────────────

type Platform = "spotify" | "soundcloud" | "youtube" | "instagram" | "tiktok" | "tidal" | "generic"

function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    if (host === "open.spotify.com") return "spotify"
    if (host.includes("soundcloud.com")) return "soundcloud"
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube"
    if (host.includes("instagram.com")) return "instagram"
    if (host.includes("tiktok.com")) return "tiktok"
    if (host.includes("tidal.com")) return "tidal"
    return "generic"
  } catch {
    return "generic"
  }
}

function extractSpotifyArtistId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/^\/artist\/([A-Za-z0-9]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function extractSpotifyTrackId(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/^\/track\/([A-Za-z0-9]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

// ── OG image fallback ─────────────────────────────────────────────────────────

async function fetchOgData(
  url: string
): Promise<{ photo_url: string | null; name: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PLAIRadar/1.0; +https://onplai.lovable.app)",
        Accept: "text/html",
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return { photo_url: null, name: null }

    const html = await res.text()

    // og:image — handle both attribute orders
    const ogImage =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      )?.[1] ??
      null

    // og:title — handle both attribute orders
    const ogTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      )?.[1] ??
      null

    const cleanTitle = ogTitle
      ? decodeHTMLEntities(ogTitle)
          .replace(/ on Apple Music$/i, "")
          .replace(/ on Spotify$/i, "")
          .replace(/ on TIDAL$/i, "")
          .replace(/ on SoundCloud$/i, "")
          .replace(/ on YouTube$/i, "")
          .replace(/ \| Spotify$/i, "")
          .replace(/ \| Apple Music$/i, "")
          .trim() || null
      : null

    return {
      photo_url: ogImage ?? null,
      name: cleanTitle,
    }
  } catch {
    return { photo_url: null, name: null }
  }
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return err("POST only")

  let body: { url?: string; user_id?: string }
  try {
    body = await req.json()
  } catch {
    return err("invalid JSON")
  }

  const { url, user_id } = body
  if (!url || !user_id) return err("url and user_id required")

  const platform = detectPlatform(url)

  // ── Spotify path ────────────────────────────────────────────────────────────

  if (platform === "spotify") {
    const artistId = extractSpotifyArtistId(url)
    const trackId = artistId ? null : extractSpotifyTrackId(url)

    if (artistId || trackId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        )

        const { data: profile } = await supabase
          .from("profiles")
          .select("spotify_access_token")
          .eq("id", user_id)
          .single()

        const token = profile?.spotify_access_token
        if (token) {
          // Resolve track URL → artist ID via /v1/tracks/{id}
          let resolvedArtistId = artistId
          if (trackId) {
            const trackRes = await fetch(
              `https://api.spotify.com/v1/tracks/${trackId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (trackRes.status === 401) return ok({ success: true, source: "none", name: null, photo_url: null, spotify_artist_id: null, spotify_monthly_listeners: null, spotify_followers: null, spotify_popularity: null, genre: null, spotify_top_tracks: null })
            if (!trackRes.ok) return ok({ success: true, source: "none", name: null, photo_url: null, spotify_artist_id: null, spotify_monthly_listeners: null, spotify_followers: null, spotify_popularity: null, genre: null, spotify_top_tracks: null })
            const trackData = await trackRes.json()
            resolvedArtistId = trackData.artists?.[0]?.id ?? null
            if (!resolvedArtistId) return ok({ success: true, source: "none", name: null, photo_url: null, spotify_artist_id: null, spotify_monthly_listeners: null, spotify_followers: null, spotify_popularity: null, genre: null, spotify_top_tracks: null })
          }

          const artistRes = await fetch(
            `https://api.spotify.com/v1/artists/${resolvedArtistId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (artistRes.status === 401) return ok({ success: true, source: "none", name: null, photo_url: null, spotify_artist_id: null, spotify_monthly_listeners: null, spotify_followers: null, spotify_popularity: null, genre: null, spotify_top_tracks: null })

          if (artistRes.ok) {
            const artist = await artistRes.json()

            // Top tracks
            let topTracks: { name: string; id: string; album_art: string | null }[] = []
            try {
              const ttRes = await fetch(
                `https://api.spotify.com/v1/artists/${resolvedArtistId}/top-tracks?market=US`,
                { headers: { Authorization: `Bearer ${token}` } }
              )
              if (ttRes.ok) {
                const ttData = await ttRes.json()
                topTracks = (ttData.tracks ?? []).slice(0, 5).map((t: any) => ({
                  name: t.name,
                  id: t.id,
                  album_art: t.album?.images?.[0]?.url ?? null,
                }))
              }
            } catch { /* non-fatal */ }

            return ok({
              success: true,
              name: artist.name ?? null,
              photo_url: artist.images?.[0]?.url ?? null,
              spotify_artist_id: artist.id ?? null,
              spotify_monthly_listeners: artist.followers?.total ?? null,
              spotify_followers: artist.followers?.total ?? null,
              spotify_popularity: artist.popularity ?? null,
              genre: artist.genres?.slice(0, 3) ?? null,
              spotify_top_tracks: topTracks.length > 0 ? topTracks : null,
              source: "spotify",
            })
          }
        }
      } catch { /* fall through to none */ }

      // Spotify URL but token missing/exhausted — do not OG-scrape spotify.com
      return ok({ success: true, source: "none", name: null, photo_url: null, spotify_artist_id: null, spotify_monthly_listeners: null, spotify_followers: null, spotify_popularity: null, genre: null, spotify_top_tracks: null })
    }
  }

  // ── OG fallback (all non-Spotify platforms + Spotify failures) ──────────────

  const og = await fetchOgData(url)

  if (og.photo_url || og.name) {
    return ok({
      success: true,
      name: og.name,
      photo_url: og.photo_url,
      spotify_artist_id: null,
      spotify_monthly_listeners: null,
      spotify_followers: null,
      spotify_popularity: null,
      genre: null,
      spotify_top_tracks: null,
      source: "og",
    })
  }

  return ok({
    success: true,
    name: null,
    photo_url: null,
    spotify_artist_id: null,
    spotify_monthly_listeners: null,
    spotify_followers: null,
    spotify_popularity: null,
    genre: null,
    spotify_top_tracks: null,
    source: "none",
  })
})
