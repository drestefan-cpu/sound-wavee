import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const fail = (error: string) =>
  new Response(JSON.stringify({ success: false, error }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

function generateShortId(): string {
  return Math.random().toString(36).slice(2, 8)
}

function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    if (host === "open.spotify.com") return "spotify"
    if (host.includes("music.apple.com")) return "applemusic"
    if (host.includes("tidal.com")) return "tidal"
    if (host.includes("youtube.com") || host === "youtu.be" || host === "music.youtube.com") return "youtube"
    if (host.includes("soundcloud.com")) return "soundcloud"
    if (host.includes("deezer.com")) return "deezer"
    if (host.includes("bandcamp.com")) return "bandcamp"
    if (host.includes("audiomack.com")) return "audiomack"
    if (host.includes("music.amazon.com") || host.includes("amazon.com/music")) return "amazon"
    if (host.includes("boomplay.com")) return "boomplay"
    if (host.includes("anghami.com")) return "anghami"
    return "og"
  } catch { return "og" }
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    // youtu.be/VIDEO_ID
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0]
    // youtube.com/watch?v=VIDEO_ID
    const v = u.searchParams.get("v")
    if (v) return v
    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/)
    if (shortsMatch) return shortsMatch[1]
    return null
  } catch { return null }
}

async function generateAppleDeveloperToken(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID")!
  const keyId = Deno.env.get("APPLE_KEY_ID")!
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")!
  const header = btoa(JSON.stringify({ alg: "ES256", kid: keyId })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ iss: teamId, iat: now, exp: now + 3600 })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const data = `${header}.${payload}`
  function pemToBuffer(pem: string) {
    const base64 = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s/g, "")
    const binary = atob(base64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
    return buffer.buffer
  }
  const key = await crypto.subtle.importKey("pkcs8", pemToBuffer(privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data))
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`
}

async function getSpotifyClientToken(): Promise<string | null> {
  try {
    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    })
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

async function fetchOgMetadata(url: string): Promise<{ title: string | null; artist: string | null; album_art_url: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PLAIBot/1.0)" }
    })
    clearTimeout(timeout)
    if (!res.ok) return { title: null, artist: null, album_art_url: null }
    const html = await res.text()
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] || null
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] || null
    const cleanedTitle = ogTitle
      ?.replace(/ on Apple Music$/i, "")
      ?.replace(/ on Spotify$/i, "")
      ?.replace(/ on TIDAL$/i, "")
      ?.replace(/ on SoundCloud$/i, "")
      ?.replace(/ on Deezer$/i, "")
      ?.replace(/ - YouTube$/i, "")
      ?.replace(/ \| Bandcamp$/i, "")
      ?.replace(/ - Official.*Video$/i, "")
      ?.trim() || null
    return { title: cleanedTitle, artist: null, album_art_url: ogImage }
  } catch { return { title: null, artist: null, album_art_url: null } }
}

serve(async (req) => {
  console.log("FUNCTION_START", req.method, req.url)
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return fail("POST only")

  let body: { url?: string; user_id?: string; sharer_username?: string }
  try { body = await req.json() } catch { return fail("invalid JSON") }

  const { url, user_id, sharer_username } = body
  if (!url) return fail("url required")

  const platform = detectPlatform(url)
  console.log("PLATFORM_DETECTED", platform, url.slice(0, 50))

  let title: string | null = null
  let artist: string | null = null
  let album: string | null = null
  let album_art_url: string | null = null
  let isrc: string | null = null
  let spotify_track_id: string | null = null
  let apple_music_id: string | null = null
  let youtube_video_id: string | null = null

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  // ── Spotify ──────────────────────────────────────────────────────────────────
  if (platform === "spotify") {
    const match = new URL(url).pathname.match(/^\/track\/([A-Za-z0-9]+)/)
    if (!match) return fail("paste a Spotify track URL — artist and playlist URLs aren't supported yet")
    const trackId = match[1]
    let token: string | null = null
    if (user_id) {
      const { data: profile } = await supabase.from("profiles").select("spotify_access_token").eq("id", user_id).single()
      token = profile?.spotify_access_token || null
    }
    if (!token) token = await getSpotifyClientToken()
    if (!token) return fail("could not authenticate with Spotify")
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return fail("could not fetch track from Spotify")
    const track = await res.json()
    title = track.name
    artist = track.artists?.[0]?.name || null
    album = track.album?.name || null
    album_art_url = track.album?.images?.[0]?.url || null
    isrc = track.external_ids?.isrc || null
    spotify_track_id = track.id
  }

  // ── Apple Music ───────────────────────────────────────────────────────────────
  else if (platform === "applemusic") {
    const u = new URL(url)
    const iParam = u.searchParams.get("i")
    const match = iParam ? [null, iParam] : u.pathname.match(/\/([0-9]+)(?:\?|$)/)
    if (!match) return fail("could not extract song ID from Apple Music URL")
    const songId = match[1]
    try {
      const devToken = await generateAppleDeveloperToken()
      const res = await fetch(`https://api.music.apple.com/v1/catalog/us/songs/${songId}`, {
        headers: { Authorization: `Bearer ${devToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const attrs = data.data?.[0]?.attributes
        if (attrs) {
          title = attrs.name
          artist = attrs.artistName
          album = attrs.albumName
          album_art_url = attrs.artwork?.url?.replace("{w}", "500").replace("{h}", "500") || null
          isrc = attrs.isrc || null
          apple_music_id = data.data?.[0]?.id || null
        }
      }
    } catch { return fail("could not fetch track from Apple Music") }
  }

  // ── Tidal ─────────────────────────────────────────────────────────────────────
  else if (platform === "tidal") {
    const match = new URL(url).pathname.match(/\/track\/([0-9]+)/)
    if (!match) return fail("paste a Tidal track URL")
    const trackId = match[1]
    try {
      const tokenRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: Deno.env.get("TIDAL_CLIENT_ID")!,
          client_secret: Deno.env.get("TIDAL_CLIENT_SECRET")!,
        })
      })
      const tokenData = await tokenRes.json()
      const tidalToken = tokenData.access_token
      if (tidalToken) {
        const res = await fetch(`https://openapi.tidal.com/tracks/${trackId}?countryCode=US`, {
          headers: { Authorization: `Bearer ${tidalToken}`, "accept": "application/vnd.tidal.v1+json" }
        })
        if (res.ok) {
          const data = await res.json()
          title = data.title || null
          artist = data.artists?.[0]?.name || null
          album = data.album?.title || null
          isrc = data.isrc || null
        }
      }
    } catch { return fail("could not fetch track from Tidal") }
    // OG fallback for album art since Tidal API may not return it
    if (!album_art_url) {
      const og = await fetchOgMetadata(url)
      album_art_url = og.album_art_url
    }
  }

  // ── YouTube ───────────────────────────────────────────────────────────────────
  else if (platform === "youtube") {
    console.log("YOUTUBE_HANDLER_START")
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) return fail("could not extract video ID from YouTube URL")
    console.log("YT_VIDEO_ID", videoId)
    const ytKey = Deno.env.get("YOUTUBE_API_KEY")
    if (!ytKey) return fail("YouTube API not configured")
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${ytKey}`)
    if (!res.ok) return fail("could not fetch video from YouTube")
    const data = await res.json()
    const snippet = data.items?.[0]?.snippet
    if (!snippet) return fail("video not found")
    title = snippet.title
      ?.replace(/ - Official (Music )?Video$/i, "")
      ?.replace(/ \(Official.*\)$/i, "")
      ?.replace(/ \[Official.*\]$/i, "")
      ?.trim() || null
    artist = snippet.channelTitle || null
    album_art_url = snippet.thumbnails?.high?.url || null
    youtube_video_id = videoId
  }

  // ── SoundCloud ────────────────────────────────────────────────────────────────
  else if (platform === "soundcloud") {
    const og = await fetchOgMetadata(url)
    title = og.title
    album_art_url = og.album_art_url
    // SoundCloud OG title format: "Track Name by Artist Name"
    if (title?.includes(" by ")) {
      const parts = title.split(" by ")
      title = parts[0].trim()
      artist = parts[1]?.trim() || null
    }
  }

  // ── Deezer ────────────────────────────────────────────────────────────────────
  else if (platform === "deezer") {
    const match = new URL(url).pathname.match(/\/track\/([0-9]+)/)
    if (match) {
      try {
        const res = await fetch(`https://api.deezer.com/track/${match[1]}`)
        if (res.ok) {
          const data = await res.json()
          title = data.title || null
          artist = data.artist?.name || null
          album = data.album?.title || null
          album_art_url = data.album?.cover_xl || data.album?.cover_big || null
          isrc = data.isrc || null
        }
      } catch {}
    }
    if (!title) {
      const og = await fetchOgMetadata(url)
      title = og.title
      album_art_url = og.album_art_url || album_art_url
    }
  }

  // ── Everything else (Bandcamp, Audiomack, Amazon, Boomplay, Anghami, etc) ────
  else {
    const og = await fetchOgMetadata(url)
    title = og.title
    artist = og.artist
    album_art_url = og.album_art_url
  }

  if (!title) return fail("could not find track info from that link — try a direct track URL")

  // ── Check if track exists in DB ───────────────────────────────────────────────
  let existingTrack: any = null

  if (isrc) {
    const { data } = await supabase.from("tracks").select("*").eq("isrc", isrc).maybeSingle()
    existingTrack = data
  }
  if (!existingTrack && spotify_track_id) {
    const { data } = await supabase.from("tracks").select("*").eq("spotify_track_id", spotify_track_id).maybeSingle()
    existingTrack = data
  }
  if (!existingTrack && apple_music_id) {
    const { data } = await supabase.from("tracks").select("*").eq("apple_music_id", apple_music_id).maybeSingle()
    existingTrack = data
  }
  if (!existingTrack && youtube_video_id) {
    const { data } = await supabase.from("tracks").select("*").eq("youtube_video_id", youtube_video_id).maybeSingle()
    existingTrack = data
  }

  // ── Create or update track ────────────────────────────────────────────────────
  let trackId: string
  let shortId: string

  if (existingTrack) {
    trackId = existingTrack.id
    shortId = existingTrack.short_id || generateShortId()
    const updates: any = {}
    if (!existingTrack.short_id) updates.short_id = shortId
    if (apple_music_id && !existingTrack.apple_music_id) updates.apple_music_id = apple_music_id
    if (youtube_video_id && !existingTrack.youtube_video_id) updates.youtube_video_id = youtube_video_id
    if (spotify_track_id && !existingTrack.spotify_track_id) updates.spotify_track_id = spotify_track_id
    if (isrc && !existingTrack.isrc) updates.isrc = isrc
    if (album_art_url && !existingTrack.album_art_url) updates.album_art_url = album_art_url
    if (Object.keys(updates).length > 0) {
      await supabase.from("tracks").update(updates).eq("id", trackId)
    }
  } else {
    shortId = generateShortId()
    const { data: newTrack, error } = await supabase.from("tracks").insert({
      title: title || "Unknown",
      artist: artist || "Unknown",
      album,
      album_art_url,
      isrc,
      spotify_track_id,
      apple_music_id,
      youtube_video_id,
      short_id: shortId,
      track_source: "share",
    }).select("id").single()
    if (error || !newTrack) return fail("could not create share link")
    trackId = newTrack.id
  }

  // ── Resolve missing platform links via ISRC ────────────────────────────────────
  if (isrc) {
    if (!apple_music_id) {
      try {
        const devToken = await generateAppleDeveloperToken()
        const res = await fetch(`https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${isrc}`, {
          headers: { Authorization: `Bearer ${devToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          const appleId = data.data?.[0]?.id
          if (appleId) {
            apple_music_id = appleId
            await supabase.from("tracks").update({ apple_music_id: appleId }).eq("id", trackId)
          }
        }
      } catch {}
    }

    if (!youtube_video_id) {
      try {
        console.log("YT_VIDEO_ID", videoId)
    const ytKey = Deno.env.get("YOUTUBE_API_KEY")
        if (ytKey && title) {
          const q = encodeURIComponent(`${title} ${artist || ""} official`)
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=1&key=${ytKey}`)
          if (res.ok) {
            const data = await res.json()
            const vid = data.items?.[0]?.id?.videoId
            if (vid) {
              youtube_video_id = vid
              await supabase.from("tracks").update({ youtube_video_id: vid }).eq("id", trackId)
            }
          }
        }
      } catch {}
    }
  }

  // ── Build share URLs ──────────────────────────────────────────────────────────
  const base = `https://onplai.lovable.app/song/${trackId}`
  const shareUrl = sharer_username ? `${base}?from=${sharer_username.toLowerCase()}` : base
  const shortUrl = `https://onplai.lovable.app/s/${shortId}`

  return ok({
    success: true,
    share_url: shareUrl,
    short_url: shortUrl,
    track: {
      id: trackId,
      short_id: shortId,
      title: title || "Unknown",
      artist: artist || "Unknown",
      album,
      album_art_url,
      spotify_track_id,
      apple_music_id,
      youtube_video_id,
      isrc,
    }
  })
})
