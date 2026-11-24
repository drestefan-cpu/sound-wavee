// Cross-platform song links.
//
// Songs arrive from one platform but PLAI shows play/share buttons for all of them. Every platform
// tags a recording with the same ISRC code, so for any song with an ISRC we look up:
//   • its Spotify ID      → tracks.spotify_link_id  (for Tidal / Apple / YouTube songs, whose
//                            spotify_track_id holds a placeholder like "tidal_…")
//   • its Apple Music ID  → tracks.apple_music_id   (for songs that don't have one yet)
// Uses PLAI's own app credentials, never a user's token. Search links remain the fallback for
// anything we can't match.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getSpotifyAppToken } from "./spotify.ts"

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

export type LinkResult = { checked: number; spotifyFound: number; appleFound: number }

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
  const result: LinkResult = { checked: 0, spotifyFound: 0, appleFound: 0 }
  if (trackIds.length === 0) return result

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

  type Row = { id: string; isrc: string; spotify_track_id: string | null; spotify_link_id: string | null; apple_music_id: string | null }
  const rows: Row[] = []
  for (let i = 0; i < trackIds.length; i += 100) {
    const { data } = await admin
      .from("tracks")
      .select("id, isrc, spotify_track_id, spotify_link_id, apple_music_id")
      .in("id", trackIds.slice(i, i + 100))
      .not("isrc", "is", null)
    rows.push(...((data || []) as Row[]))
  }
  result.checked = rows.length

  // ── Spotify: songs from other platforms without a Spotify link yet ──
  const needSpotify = rows.filter((r) => isPlaceholderSpotifyId(r.spotify_track_id) && !r.spotify_link_id).slice(0, spotifyLimit)
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

  return result
}
