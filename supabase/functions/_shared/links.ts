// Cross-platform song links.
//
// Songs arrive from one platform but PLAI shows play/share buttons for all of them. Every platform
// tags a recording with the same ISRC code, so for any song with an ISRC we look up:
//   • its Spotify ID      → tracks.spotify_link_id  (for Tidal / Apple / YouTube songs, whose
//                            spotify_track_id holds a placeholder like "tidal_…")
//   • its Apple Music ID  → tracks.apple_music_id   (for songs that don't have one yet)
//   • its Tidal ID        → tracks.tidal_track_id   (for songs that don't have one yet)
// Uses PLAI's own app credentials, never a user's token. Search links remain the fallback for
// anything we can't match.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getSpotifyAppToken } from "./spotify.ts"

/** Songs looked up on the other apps are re-checked after this many days */
const RECHECK_DAYS = 7
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b64url = (s: string) => btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

/** Apple Music developer token (ES256 JWT, valid 1 hour). */
export async function generateAppleDeveloperToken(): Promise<string | null> {
  try {
    const teamId = Deno.env.get("APPLE_TEAM_ID")
    const keyId = Deno.env.get("APPLE_KEY_ID")
    const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")
    if (!teamId || !keyId || !privateKey) return null
    const now = Math.floor(Date.now() / 1000)
    const data = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 3600 }))}`
    const base64 = privateKey.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s/g, "")
    const binary = atob(base64)
    const buf = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
    const key = await crypto.subtle.importKey("pkcs8", buf.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data))
    return `${data}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`
  } catch {
    return null
  }
}

const isPlaceholderSpotifyId = (id: string | null) => /^(tidal_|apple:|yt:|share:)/.test(id || "")

export type LinkResult = { checked: number; spotifyFound: number; appleFound: number; tidalFound: number }

/**
 * Fills in missing Spotify / Apple Music IDs for the given PLAI track ids.
 * `spotifyLimit` bounds the one-at-a-time Spotify searches per call; the rest fill in later.
 */
export async function resolveTrackLinks(
  admin: SupabaseClient,
  trackIds: string[],
  opts: { spotifyLimit?: number } = {},
): Promise<LinkResult> {
  const spotifyLimit = opts.spotifyLimit ?? 60
  const result: LinkResult = { checked: 0, spotifyFound: 0, appleFound: 0, tidalFound: 0 }
  if (trackIds.length === 0) return result

  // Skip songs looked up in the last 7 days (most unmatched songs stay unmatched; no need to ask every sync)
  {
    const recent = new Set<string>()
    const since = new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString()
    for (let i = 0; i < trackIds.length; i += 200) {
      const { data } = await admin
        .from("tracks")
        .select("id")
        .in("id", trackIds.slice(i, i + 200))
        .gte("links_checked_at", since)
      for (const r of (data || []) as { id: string }[]) recent.add(r.id)
    }
    trackIds = trackIds.filter((id) => !recent.has(id))
    if (trackIds.length === 0) return result
  }

  // ── Step 0: older Apple Music songs were saved without an ISRC — get it from Apple's catalogue ──
  {
    const missingIsrc: { id: string; apple_music_id: string }[] = []
    for (let i = 0; i < trackIds.length; i += 100) {
      const { data } = await admin
        .from("tracks")
        .select("id, apple_music_id")
        .in("id", trackIds.slice(i, i + 100))
        .is("isrc", null)
        .not("apple_music_id", "is", null)
      missingIsrc.push(...((data || []) as { id: string; apple_music_id: string }[]))
    }
    if (missingIsrc.length > 0) {
      const devToken = await generateAppleDeveloperToken()
      if (devToken) {
        for (let i = 0; i < missingIsrc.length; i += 100) {
          const batch = missingIsrc.slice(i, i + 100)
          const res = await fetch(
            `https://api.music.apple.com/v1/catalog/us/songs?ids=${batch.map((r) => r.apple_music_id).join(",")}`,
            { headers: { Authorization: `Bearer ${devToken}` } },
          )
          if (!res.ok) continue
          const data = await res.json()
          const isrcByAppleId = new Map<string, string>()
          for (const song of (data.data || []) as any[]) {
            if (song.id && song.attributes?.isrc) isrcByAppleId.set(String(song.id), song.attributes.isrc)
          }
          for (const row of batch) {
            const isrc = isrcByAppleId.get(row.apple_music_id)
            if (isrc) await admin.from("tracks").update({ isrc }).eq("id", row.id)
          }
        }
      }
    }
  }

  type Row = { id: string; isrc: string; spotify_track_id: string | null; spotify_link_id: string | null; apple_music_id: string | null; tidal_track_id: string | null }
  const rows: Row[] = []
  for (let i = 0; i < trackIds.length; i += 100) {
    const { data } = await admin
      .from("tracks")
      .select("id, isrc, spotify_track_id, spotify_link_id, apple_music_id, tidal_track_id")
      .in("id", trackIds.slice(i, i + 100))
      .not("isrc", "is", null)
    rows.push(...((data || []) as Row[]))
  }
  result.checked = rows.length

  // ── Spotify: songs from other platforms without a Spotify link yet ──
  const wantSpotify = rows.filter((r) => isPlaceholderSpotifyId(r.spotify_track_id) && !r.spotify_link_id)
  const needSpotify = wantSpotify.slice(0, spotifyLimit)
  // songs left for next time because of the Spotify limit aren't marked as checked
  const deferred = new Set(wantSpotify.slice(spotifyLimit).map((r) => r.id))
  if (needSpotify.length > 0) {
    const token = await getSpotifyAppToken()
    if (token) {
      for (const row of needSpotify) {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(row.isrc)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (res.status === 429) break // asked to slow down; finish next time
        if (res.ok) {
          const data = await res.json()
          const spotifyId: string | undefined = data.tracks?.items?.[0]?.id
          if (spotifyId) {
            await admin.from("tracks").update({ spotify_link_id: spotifyId }).eq("id", row.id)
            result.spotifyFound++
          }
        }
        await sleep(80)
      }
    }
  }

  // ── Apple Music: any song without an Apple ID (25 ISRCs per request) ──
  const needApple = rows.filter((r) => !r.apple_music_id)
  if (needApple.length > 0) {
    const devToken = await generateAppleDeveloperToken()
    if (devToken) {
      for (let i = 0; i < needApple.length; i += 25) {
        const batch = needApple.slice(i, i + 25)
        const isrcs = [...new Set(batch.map((r) => r.isrc))].join(",")
        const res = await fetch(`https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrcs)}`, {
          headers: { Authorization: `Bearer ${devToken}` },
        })
        if (res.status === 429) break
        if (!res.ok) continue
        const data = await res.json()
        const appleIdByIsrc = new Map<string, string>()
        for (const song of (data.data || []) as any[]) {
          const isrc = song.attributes?.isrc
          if (isrc && song.id && !appleIdByIsrc.has(isrc)) appleIdByIsrc.set(isrc, String(song.id))
        }
        for (const row of batch) {
          const appleId = appleIdByIsrc.get(row.isrc)
          if (!appleId) continue
          // apple_music_id is unique; if another row already has it, keep that one and skip
          const { error } = await admin.from("tracks").update({ apple_music_id: appleId }).eq("id", row.id).is("apple_music_id", null)
          if (!error) result.appleFound++
        }
        await sleep(100)
      }
    }
  }

  // ── Tidal: any song without a Tidal ID (20 ISRCs per request, paced for TIDAL's rate limit) ──
  const needTidal = rows.filter((r) => !r.tidal_track_id)
  if (needTidal.length > 0) {
    const tidalToken = await getTidalAppToken()
    if (tidalToken) {
      for (let i = 0; i < needTidal.length; i += 20) {
        const batch = needTidal.slice(i, i + 20)
        const url = new URL("https://openapi.tidal.com/v2/tracks")
        url.searchParams.set("countryCode", "US")
        for (const isrc of new Set(batch.map((r) => r.isrc))) url.searchParams.append("filter[isrc]", isrc)
        let res = await fetch(url, { headers: { Authorization: `Bearer ${tidalToken}`, Accept: "application/vnd.api+json" } })
        if (res.status === 429) {
          const wait = Math.min((Number(res.headers.get("Retry-After")) || 2) * 1000, 10_000)
          await sleep(wait)
          res = await fetch(url, { headers: { Authorization: `Bearer ${tidalToken}`, Accept: "application/vnd.api+json" } })
          if (res.status === 429) break // still limited; the rest fill in next time
        }
        if (res.ok) {
          const data = await res.json()
          const tidalIdByIsrc = new Map<string, string>()
          for (const t of (data.data || []) as any[]) {
            const isrc = t.attributes?.isrc
            if (isrc && t.id && !tidalIdByIsrc.has(isrc)) tidalIdByIsrc.set(isrc, String(t.id))
          }
          for (const row of batch) {
            const tidalId = tidalIdByIsrc.get(row.isrc)
            if (!tidalId) continue
            const { error } = await admin.from("tracks").update({ tidal_track_id: tidalId }).eq("id", row.id).is("tidal_track_id", null)
            if (!error) result.tidalFound++
          }
        }
        await sleep(600)
      }
    }
  }

  // Remember these were looked up (songs without an ISRC count too: there's nothing to match them by)
  const checkedIds = trackIds.filter((id) => !deferred.has(id))
  for (let i = 0; i < checkedIds.length; i += 200) {
    await admin.from("tracks").update({ links_checked_at: new Date().toISOString() }).in("id", checkedIds.slice(i, i + 200))
  }

  return result
}

/** PLAI's own TIDAL app token (client-credentials flow) for catalogue lookups. */
export async function getTidalAppToken(): Promise<string | null> {
  try {
    const clientId = Deno.env.get("TIDAL_CLIENT_ID")
    const clientSecret = Deno.env.get("TIDAL_CLIENT_SECRET")
    if (!clientId || !clientSecret) return null
    const res = await fetch("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    })
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

export type TidalTrackInfo = {
  title: string
  artist: string | null
  album: string | null
  albumArtUrl: string | null
  isrc: string | null
}

/**
 * One Tidal track's details from TIDAL's current API (v2, JSON:API):
 * /tracks/{id}?include=artists,albums, then the album's cover art.
 */
export async function fetchTidalTrack(tidalId: string): Promise<TidalTrackInfo | null> {
  const token = await getTidalAppToken()
  if (!token) return null
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" }
  const get = async (url: string) => {
    let res = await fetch(url, { headers })
    if (res.status === 429) {
      await sleep(Math.min((Number(res.headers.get("Retry-After")) || 2) * 1000, 8000))
      res = await fetch(url, { headers })
    }
    return res.ok ? res.json() : null
  }

  const doc = await get(`https://openapi.tidal.com/v2/tracks/${encodeURIComponent(tidalId)}?countryCode=US&include=artists&include=albums`)
  const t = doc?.data
  if (!t?.attributes?.title) return null
  const included = new Map<string, any>()
  for (const inc of (doc.included || []) as any[]) included.set(`${inc.type}:${inc.id}`, inc)

  const artists = ((t.relationships?.artists?.data || []) as any[])
    .map((a) => included.get(`artists:${a.id}`)?.attributes?.name)
    .filter(Boolean)
  const albumRef = t.relationships?.albums?.data?.[0]
  const album = albumRef ? included.get(`albums:${albumRef.id}`) : null

  let albumArtUrl: string | null = null
  if (albumRef?.id) {
    const albumDoc = await get(`https://openapi.tidal.com/v2/albums/${encodeURIComponent(albumRef.id)}?countryCode=US&include=coverArt`)
    const artId = albumDoc?.data?.relationships?.coverArt?.data?.[0]?.id
    const artwork = ((albumDoc?.included || []) as any[]).find((inc) => inc.type === "artworks" && String(inc.id) === String(artId))
    const files: any[] = artwork?.attributes?.files || []
    const best = files
      .filter((f) => f?.href)
      .sort((a, b) => Math.abs((a.meta?.width ?? 640) - 640) - Math.abs((b.meta?.width ?? 640) - 640))[0]
    albumArtUrl = best?.href || null
  }

  const version: string | undefined = t.attributes.version
  return {
    title: version ? `${t.attributes.title} (${version})` : t.attributes.title,
    artist: artists.join(", ") || null,
    album: album?.attributes?.title || null,
    albumArtUrl,
    isrc: t.attributes.isrc || null,
  }
}
