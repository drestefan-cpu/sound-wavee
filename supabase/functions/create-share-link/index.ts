import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SITE = "https://onplai.lovable.app"

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

const fail = (error: string) =>
  new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// ── Platform detection ────────────────────────────────────────────────────────

type Platform = "spotify" | "applemusic" | "tidal" | "youtube" | "unknown"

function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    if (host === "open.spotify.com") return "spotify"
    if (host.includes("music.apple.com")) return "applemusic"
    if (host.includes("tidal.com")) return "tidal"
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube"
    return "unknown"
  } catch {
    return "unknown"
  }
}

// ── Apple Music JWT ───────────────────────────────────────────────────────────

async function getAppleMusicToken(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID")!
  const keyId = Deno.env.get("APPLE_KEY_ID")!
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")!

  const header = btoa(JSON.stringify({ alg: "ES256", kid: keyId }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ iss: teamId, iat: now, exp: now + 15777000 }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const data = `${header}.${payload}`

  function pemToBuffer(pem: string) {
    const base64 = pem
      .replace(/\\n/g, "\n")
      .replace(/-----[^-]+-----/g, "")
      .replace(/\s/g, "")
    const binary = atob(base64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
    return buffer.buffer
  }

  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBuffer(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  )

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key, new TextEncoder().encode(data)
  )

  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`
}

// ── Spotify client credentials ────────────────────────────────────────────────

async function getSpotifyClientToken(): Promise<string | null> {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")
  if (!clientId || !clientSecret) return null

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token ?? null
}

// ── short_id generator ────────────────────────────────────────────────────────

function generateShortId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

// ── YouTube title cleaner ─────────────────────────────────────────────────────

function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](official\s*(video|audio|mv|music\s*video|lyric\s*video)|lyrics?|audio)[\)\]]/gi, "")
    .replace(/\s*-\s*(official\s*(video|audio|mv|music\s*video)|lyrics?|audio)$/gi, "")
    .trim()
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return fail("POST only")

  let body: { url?: string; user_id?: string; sharer_username?: string }
  try {
    body = await req.json()
  } catch {
    return fail("invalid JSON")
  }

  const { url, user_id, sharer_username } = body
  if (!url) return fail("url required")

  const platform = detectPlatform(url)
  if (platform === "unknown") return fail("unsupported URL")

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // ── Track metadata fetched from source platform ───────────────────────────

  let title: string | null = null
  let artist: string | null = null
  let album: string | null = null
  let album_art_url: string | null = null
  let isrc: string | null = null
  let spotify_track_id: string | null = null
  let apple_music_id: string | null = null
  let youtube_video_id: string | null = null
  let tidal_track_id: string | null = null

  // ── Spotify ───────────────────────────────────────────────────────────────

  if (platform === "spotify") {
    const pathname = new URL(url).pathname

    const artistMatch = pathname.match(/^\/artist\/([A-Za-z0-9]+)/)
    if (artistMatch) return fail("artist URLs not supported for share links, use track URLs")

    const trackMatch = pathname.match(/^\/track\/([A-Za-z0-9]+)/)
    if (!trackMatch) return fail("unsupported Spotify URL")

    spotify_track_id = trackMatch[1]

    // Prefer user token; fall back to client credentials
    let token: string | null = null
    if (user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("spotify_access_token")
        .eq("id", user_id)
        .single()
      token = (profile as any)?.spotify_access_token ?? null
    }
    if (!token) token = await getSpotifyClientToken()
    if (!token) return fail("could not fetch track info")

    const trackRes = await fetch(
      `https://api.spotify.com/v1/tracks/${spotify_track_id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!trackRes.ok) return fail("could not fetch track info")
    const t = await trackRes.json()

    title = t.name ?? null
    artist = t.artists?.[0]?.name ?? null
    album = t.album?.name ?? null
    album_art_url = t.album?.images?.[0]?.url ?? null
    isrc = t.external_ids?.isrc ?? null
  }

  // ── Apple Music ───────────────────────────────────────────────────────────

  else if (platform === "applemusic") {
    const pathname = new URL(url).pathname

    // music.apple.com/*/album/*/1234567890 or music.apple.com/*/song/1234567890
    const songMatch =
      pathname.match(/\/album\/[^/]+\/([0-9]+)$/) ??
      pathname.match(/\/song\/([0-9]+)$/)
    if (!songMatch) return fail("unsupported Apple Music URL")

    apple_music_id = songMatch[1]

    let devToken: string
    try {
      devToken = await getAppleMusicToken()
    } catch {
      return fail("could not fetch track info")
    }

    const songRes = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs/${apple_music_id}`,
      { headers: { Authorization: `Bearer ${devToken}` } }
    )
    if (!songRes.ok) return fail("could not fetch track info")
    const songData = await songRes.json()
    const attrs = songData.data?.[0]?.attributes
    if (!attrs) return fail("could not fetch track info")

    title = attrs.name ?? null
    artist = attrs.artistName ?? null
    album = attrs.albumName ?? null
    album_art_url = attrs.artwork?.url
      ? attrs.artwork.url.replace("{w}x{h}", "500x500")
      : null
    isrc = attrs.isrc ?? null
  }

  // ── Tidal ─────────────────────────────────────────────────────────────────

  else if (platform === "tidal") {
    const trackMatch = new URL(url).pathname.match(/\/track\/([0-9]+)/)
    if (!trackMatch) return fail("unsupported Tidal URL")

    tidal_track_id = trackMatch[1]

    const clientId = Deno.env.get("TIDAL_CLIENT_ID")
    const clientSecret = Deno.env.get("TIDAL_CLIENT_SECRET")
    if (!clientId || !clientSecret) return fail("could not fetch track info")

    const tokenRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    })
    if (!tokenRes.ok) return fail("could not fetch track info")
    const tokenData = await tokenRes.json()
    const tidalToken = tokenData.access_token
    if (!tidalToken) return fail("could not fetch track info")

    const trackRes = await fetch(
      `https://openapi.tidal.com/tracks/${tidal_track_id}?countryCode=US`,
      { headers: { Authorization: `Bearer ${tidalToken}` } }
    )
    if (!trackRes.ok) return fail("could not fetch track info")
    const t = await trackRes.json()

    title = t.title ?? null
    artist = t.artists?.[0]?.name ?? null
    album = t.album?.title ?? null
    isrc = t.isrc ?? null
  }

  // ── YouTube ───────────────────────────────────────────────────────────────

  else if (platform === "youtube") {
    const urlObj = new URL(url)
    youtube_video_id =
      urlObj.searchParams.get("v") ??
      (urlObj.hostname === "youtu.be" ? urlObj.pathname.slice(1) : null)
    if (!youtube_video_id) return fail("unsupported YouTube URL")

    const ytKey = Deno.env.get("YOUTUBE_API_KEY")
    if (!ytKey) return fail("could not fetch track info")

    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtube_video_id}&key=${ytKey}`
    )
    if (!videoRes.ok) return fail("could not fetch track info")
    const videoData = await videoRes.json()
    const snippet = videoData.items?.[0]?.snippet
    if (!snippet) return fail("could not fetch track info")

    title = cleanYouTubeTitle(snippet.title ?? "")
    artist = snippet.channelTitle ?? null
    album_art_url = snippet.thumbnails?.high?.url ?? null
  }

  if (!title || !artist) return fail("could not fetch track info")

  // ── Step 2: check if track already exists ────────────────────────────────

  let existingTrack: any = null

  if (isrc) {
    const { data } = await (supabase
      .from("tracks")
      .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
      .eq("isrc", isrc)
      .maybeSingle() as any)
    existingTrack = data
  }

  if (!existingTrack) {
    let query: any = null
    if (spotify_track_id) {
      const { data } = await (supabase
        .from("tracks")
        .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
        .eq("spotify_track_id", spotify_track_id)
        .maybeSingle() as any)
      query = data
    } else if (apple_music_id) {
      const { data } = await (supabase
        .from("tracks")
        .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
        .eq("apple_music_id", apple_music_id)
        .maybeSingle() as any)
      query = data
    } else if (tidal_track_id) {
      const { data } = await (supabase
        .from("tracks")
        .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
        .eq("tidal_track_id", tidal_track_id)
        .maybeSingle() as any)
      query = data
    } else if (youtube_video_id) {
      const { data } = await (supabase
        .from("tracks")
        .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
        .eq("youtube_video_id", youtube_video_id)
        .maybeSingle() as any)
      query = data
    }
    existingTrack = query
  }

  // ── Step 3: create track if not found ────────────────────────────────────

  let track: any = existingTrack

  if (!track) {
    // Generate unique short_id
    let short_id = generateShortId()
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: collision } = await (supabase
        .from("tracks")
        .select("id")
        .eq("short_id", short_id)
        .maybeSingle() as any)
      if (!collision) break
      short_id = generateShortId()
    }

    const { data: inserted, error: insertError } = await (supabase
      .from("tracks")
      .insert({
        title,
        artist,
        album: album ?? null,
        album_art_url: album_art_url ?? null,
        isrc: isrc ?? null,
        spotify_track_id: spotify_track_id ?? null,
        apple_music_id: apple_music_id ?? null,
        youtube_video_id: youtube_video_id ?? null,
        tidal_track_id: tidal_track_id ?? null,
        short_id,
        track_source: "share",
      } as any)
      .select("id, short_id, spotify_track_id, apple_music_id, youtube_video_id, tidal_track_id")
      .single() as any)

    if (insertError || !inserted) return fail("could not create share link")
    track = inserted
  }

  // ── Step 4: resolve missing platform links via ISRC ──────────────────────

  if (isrc) {
    const updates: Record<string, string> = {}

    // Merge fetched IDs onto what was already in DB
    if (!track.spotify_track_id && spotify_track_id) updates.spotify_track_id = spotify_track_id
    if (!track.apple_music_id && apple_music_id) updates.apple_music_id = apple_music_id
    if (!track.youtube_video_id && youtube_video_id) updates.youtube_video_id = youtube_video_id
    if (!track.tidal_track_id && tidal_track_id) updates.tidal_track_id = tidal_track_id

    // Resolve Apple Music via ISRC
    if (!track.apple_music_id && !apple_music_id) {
      try {
        const devToken = await getAppleMusicToken()
        const res = await fetch(
          `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${isrc}`,
          { headers: { Authorization: `Bearer ${devToken}` } }
        )
        if (res.ok) {
          const data = await res.json()
          const found = data.data?.[0]?.id
          if (found) { apple_music_id = found; updates.apple_music_id = found }
        }
      } catch { /* non-fatal */ }
    }

    // Resolve YouTube via search
    if (!track.youtube_video_id && !youtube_video_id) {
      try {
        const ytKey = Deno.env.get("YOUTUBE_API_KEY")
        if (ytKey) {
          const q = encodeURIComponent(`${title} ${artist} official video`)
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=1&key=${ytKey}`
          )
          if (res.ok) {
            const data = await res.json()
            const found = data.items?.[0]?.id?.videoId
            if (found) { youtube_video_id = found; updates.youtube_video_id = found }
          }
        }
      } catch { /* non-fatal */ }
    }

    if (Object.keys(updates).length > 0) {
      await (supabase.from("tracks").update(updates).eq("id", track.id) as any)
    }
  }

  // Merge resolved IDs back for the response
  const finalSpotifyId = track.spotify_track_id ?? spotify_track_id ?? null
  const finalAppleId = track.apple_music_id ?? apple_music_id ?? null
  const finalYouTubeId = track.youtube_video_id ?? youtube_video_id ?? null

  // ── Step 5: build and return share URL ───────────────────────────────────

  const shareUrl = sharer_username
    ? `${SITE}/song/${track.id}?from=${sharer_username.toLowerCase()}`
    : `${SITE}/song/${track.id}`

  return ok({
    success: true,
    share_url: shareUrl,
    short_url: track.short_id ? `${SITE}/s/${track.short_id}` : null,
    track: {
      id: track.id,
      short_id: track.short_id ?? null,
      title,
      artist,
      album: album ?? null,
      album_art_url: album_art_url ?? null,
      spotify_track_id: finalSpotifyId,
      apple_music_id: finalAppleId,
      youtube_video_id: finalYouTubeId,
      isrc: isrc ?? null,
    },
  })
})
