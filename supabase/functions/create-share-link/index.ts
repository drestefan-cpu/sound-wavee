import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { optionalCallerId } from "../_shared/auth.ts"
import { fetchPublicHtml } from "../_shared/safeFetch.ts"
import { fetchTidalTrack, resolveTrackLinks } from "../_shared/links.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const fail = (error: string) =>
  new Response(JSON.stringify({ success: false, error }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

// 6-character share code (a–z, 0–9) from a cryptographic random source. Unique index on tracks.short_id.
function generateShortId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

// Supabase runs background work after the response with EdgeRuntime.waitUntil
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const PLACEHOLDER_SPOTIFY_ID = /^(tidal_|apple:|yt:|share:)/

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
    // Only public websites, with a timeout and size cap (see _shared/safeFetch.ts)
    const html = await fetchPublicHtml(url, "Mozilla/5.0 (compatible; PLAIBot/1.0)")
    if (!html) return { title: null, artist: null, album_art_url: null }
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return fail("send a POST request")

  let body: { url?: string; sharer_username?: string }
  try { body = await req.json() } catch { return fail("that request couldn't be read — try again") }

  const { url, sharer_username } = body
  if (!url) return fail("share a song link to make a PLAI link")

  const platform = detectPlatform(url)

  let title: string | null = null
  let artist: string | null = null
  let album: string | null = null
  let album_art_url: string | null = null
  let isrc: string | null = null
  let spotify_track_id: string | null = null
  let apple_music_id: string | null = null
  let youtube_video_id: string | null = null
  let tidalIdFromUrl: string | null = null

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  // ── Spotify ──────────────────────────────────────────────────────────────────
  if (platform === "spotify") {
    const match = new URL(url).pathname.match(/^\/track\/([A-Za-z0-9]+)/)
    if (!match) return fail("share a single song — Spotify artists, albums and playlists aren't supported yet")
    const trackId = match[1]
    let token: string | null = null
    // Use the signed-in caller's own Spotify connection if there is one (never another user's)
    const callerId = await optionalCallerId(req, supabase)
    if (callerId) {
      const { data: profile } = await supabase.from("profiles").select("spotify_access_token").eq("id", callerId).single()
      token = profile?.spotify_access_token || null
    }
    if (!token) token = await getSpotifyClientToken()
    if (!token) return fail("Spotify isn't responding right now — try again in a moment")
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return fail("couldn't find that song on Spotify")
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
    if (!match) return fail("share a single song — Apple Music albums and playlists aren't supported yet")
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
          try {
          title = attrs.name
          artist = attrs.artistName
          album = attrs.albumName
          album_art_url = attrs.artwork?.url?.replace("{w}", "500").replace("{h}", "500") || null
          isrc = attrs.isrc || null
          apple_music_id = data.data?.[0]?.id || null
          } catch {}
        }
      }
    } catch { return fail("couldn't find that song on Apple Music") }
  }

  // ── Tidal ─────────────────────────────────────────────────────────────────────
  else if (platform === "tidal") {
    const match = new URL(url).pathname.match(/\/track\/([0-9]+)/)
    if (!match) return fail("share a single song — Tidal albums and playlists aren't supported yet")
    tidalIdFromUrl = match[1]
    // 1. Already in PLAI? (most Tidal songs are, from syncs and ISRC matching)
    const { data: known } = await supabase
      .from("tracks")
      .select("title, artist, album, album_art_url, isrc")
      .eq("tidal_track_id", tidalIdFromUrl)
      .limit(1)
      .maybeSingle()
    if (known?.title) {
      title = known.title
      artist = known.artist
      album = known.album
      album_art_url = known.album_art_url
      isrc = known.isrc
    } else {
      // 2. Ask TIDAL's current API (v2)
      const info = await fetchTidalTrack(tidalIdFromUrl)
      if (info) {
        title = info.title
        artist = info.artist
        album = info.album
        album_art_url = info.albumArtUrl
        isrc = info.isrc
      }
    }
    if (!album_art_url) {
      const og = await fetchOgMetadata(url)
      album_art_url = og.album_art_url
    }
  }

  // ── YouTube ───────────────────────────────────────────────────────────────────
  else if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) return fail("share a single video or song from YouTube")
    const ytKey = Deno.env.get("YOUTUBE_API_KEY")
    if (!ytKey) return fail("YouTube links aren't available right now")
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${ytKey}`)
    if (!res.ok) return fail("couldn't reach YouTube — try again in a moment")
    const data = await res.json()
    const snippet = data.items?.[0]?.snippet
    if (!snippet) return fail("couldn't find that YouTube video")
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

  // ── Other known music sites (Bandcamp, Audiomack, Amazon Music, Boomplay, Anghami) ──
  // Links from anywhere else are refused, so nobody can turn an arbitrary page (with its own
  // title and image) into a PLAI link under our domain.
  else if (platform === "og") {
    return fail("that link isn't from a music app — share a song from Spotify, Apple Music, Tidal, YouTube Music, SoundCloud, Deezer or Bandcamp")
  }
  else {
    const og = await fetchOgMetadata(url)
    title = og.title
    artist = og.artist
    album_art_url = og.album_art_url
  }

  if (!title) return fail("couldn't find a song at that link — share a single track")

  // ── Resolve Spotify ID via ISRC for non-Spotify links (Apple, Tidal, Deezer) ──
  if (!spotify_track_id && isrc) {
    try {
      const token = await getSpotifyClientToken()
      if (token) {
        const res = await fetch(`https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          spotify_track_id = data.tracks?.items?.[0]?.id || null
        }
      }
    } catch {}
  }

  // ── Find the song in PLAI (ISRC first, then platform IDs) ────────────────────
  let existingTrack: any = null
  try {
    if (isrc) {
      // Several rows can share an ISRC (same song synced from different apps) — use the earliest
      const { data } = await supabase.from("tracks").select("*").eq("isrc", isrc).order("created_at", { ascending: true }).limit(1).maybeSingle()
      if (data) existingTrack = data
    }
    if (!existingTrack && apple_music_id) {
      const { data } = await supabase.from("tracks").select("*").eq("apple_music_id", apple_music_id).limit(1).maybeSingle()
      if (data) existingTrack = data
    }
    if (!existingTrack && spotify_track_id) {
      const { data } = await supabase.from("tracks").select("*").eq("spotify_track_id", spotify_track_id).limit(1).maybeSingle()
      if (data) existingTrack = data
    }
    if (!existingTrack && tidalIdFromUrl) {
      const { data } = await supabase.from("tracks").select("*").eq("tidal_track_id", tidalIdFromUrl).limit(1).maybeSingle()
      if (data) existingTrack = data
    }
    if (!existingTrack && youtube_video_id) {
      const { data } = await supabase.from("tracks").select("*").eq("youtube_video_id", youtube_video_id).limit(1).maybeSingle()
      if (data) existingTrack = data
    }
  } catch (e) {
    console.error("Track lookup failed:", String(e))
  }

  // ── Create or update the song ────────────────────────────────────────────────
  let trackId: string
  let shortId: string
  try {
    if (existingTrack) {
      trackId = existingTrack.id
      shortId = existingTrack.short_id || generateShortId()
      const updates: Record<string, unknown> = {}
      if (!existingTrack.short_id) updates.short_id = shortId
      if (apple_music_id && !existingTrack.apple_music_id) updates.apple_music_id = apple_music_id
      if (youtube_video_id && !existingTrack.youtube_video_id) updates.youtube_video_id = youtube_video_id
      if (tidalIdFromUrl && !existingTrack.tidal_track_id) updates.tidal_track_id = tidalIdFromUrl
      // Replace a missing or "share:" placeholder Spotify ID with the real one
      if (spotify_track_id && (!existingTrack.spotify_track_id || existingTrack.spotify_track_id.startsWith("share:"))) updates.spotify_track_id = spotify_track_id
      // Songs from Tidal / Apple / YouTube keep their placeholder ID; store the real Spotify ID alongside it
      else if (spotify_track_id && /^(tidal_|apple:|yt:)/.test(existingTrack.spotify_track_id || "") && !existingTrack.spotify_link_id) updates.spotify_link_id = spotify_track_id
      if (isrc && !existingTrack.isrc) updates.isrc = isrc
      if (album_art_url && !existingTrack.album_art_url) updates.album_art_url = album_art_url
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("tracks").update(updates).eq("id", trackId)
        // A share code clash is near-impossible, but never leave a song without one
        if (error && updates.short_id) {
          shortId = generateShortId()
          await supabase.from("tracks").update({ ...updates, short_id: shortId }).eq("id", trackId)
        }
      }
    } else {
      let inserted: { id: string } | null = null
      shortId = generateShortId()
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        const { data, error } = await supabase.from("tracks").insert({
          title: title || "Unknown",
          artist: artist || "Unknown",
          album,
          album_art_url,
          isrc,
          // spotify_track_id is NOT NULL UNIQUE — use a unique placeholder for non-Spotify shares
          spotify_track_id: spotify_track_id ?? `share:${crypto.randomUUID()}`,
          apple_music_id,
          youtube_video_id,
          tidal_track_id: tidalIdFromUrl,
          short_id: shortId,
          track_source: "share",
        }).select("id").single()
        if (data) inserted = data
        else if (error?.code === "23505" && error.message.includes("short_id")) shortId = generateShortId() // code clash: retry
        else {
          console.error("Track insert failed:", error?.message)
          break
        }
      }
      if (!inserted) return fail("couldn't create a share link for that song — try again")
      trackId = inserted.id
    }
  } catch (err) {
    console.error("create-share-link error:", String(err))
    return fail("couldn't create a share link for that song — try again")
  }

  // ── Fill in the other platforms' links after replying, so sharing feels instant ──
  const fillLinks = resolveTrackLinks(supabase, [trackId], { spotifyLimit: 1 })
    .catch((err) => console.error("Link lookup failed (share link already sent):", String(err)))
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(fillLinks)
  else await fillLinks

  // ── Reply with every link already known for this song ───────────────────────
  const known = existingTrack || {}
  const knownSpotify = known.spotify_track_id && !PLACEHOLDER_SPOTIFY_ID.test(known.spotify_track_id) ? known.spotify_track_id : known.spotify_link_id
  const base = `https://plai.delaneyprojects.xyz/song/${trackId}`
  return ok({
    success: true,
    share_url: sharer_username ? `${base}?from=${encodeURIComponent(sharer_username.toLowerCase())}` : base,
    short_url: `https://plai.delaneyprojects.xyz/s/${shortId}`,
    track: {
      id: trackId,
      short_id: shortId,
      title: known.title || title || "Unknown",
      artist: known.artist || artist || "Unknown",
      album: known.album ?? album,
      album_art_url: known.album_art_url || album_art_url,
      spotify_track_id: spotify_track_id || knownSpotify || null,
      apple_music_id: apple_music_id || known.apple_music_id || null,
      youtube_video_id: youtube_video_id || known.youtube_video_id || null,
      tidal_track_id: tidalIdFromUrl || known.tidal_track_id || null,
      isrc: isrc || known.isrc || null,
    },
  })
})
