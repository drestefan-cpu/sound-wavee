// Looks up the real Spotify track ID for songs that came from another platform (Tidal, Apple
// Music), using the ISRC code every platform shares, and stores it in tracks.spotify_link_id so
// play buttons and links can open the exact song in Spotify.
// Uses PLAI's own Spotify app credentials (client-credentials flow), never a user's token.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function getSpotifyAppToken(): Promise<string | null> {
  try {
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
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

/**
 * For the given PLAI track ids, fills in spotify_link_id where it's missing and an ISRC is known.
 * Bounded by `limit` per call so a sync never spends long on it; the rest fill in on later syncs.
 * Returns how many links were found.
 */
export async function resolveSpotifyLinks(
  admin: SupabaseClient,
  trackIds: string[],
  limit = 60,
): Promise<number> {
  if (trackIds.length === 0) return 0

  const candidates: { id: string; isrc: string }[] = []
  for (let i = 0; i < trackIds.length && candidates.length < limit; i += 100) {
    const { data } = await admin
      .from("tracks")
      .select("id, isrc, spotify_track_id, spotify_link_id")
      .in("id", trackIds.slice(i, i + 100))
      .is("spotify_link_id", null)
      .not("isrc", "is", null)
    for (const row of data || []) {
      const placeholder = /^(tidal_|apple:|yt:|share:)/.test(row.spotify_track_id || "")
      if (placeholder && row.isrc) candidates.push({ id: row.id, isrc: row.isrc })
      if (candidates.length >= limit) break
    }
  }
  if (candidates.length === 0) return 0

  const token = await getSpotifyAppToken()
  if (!token) return 0

  let found = 0
  for (const { id, isrc } of candidates) {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.status === 429) break // Spotify asked us to slow down; finish on the next sync
    if (!res.ok) continue
    const data = await res.json()
    const spotifyId: string | undefined = data.tracks?.items?.[0]?.id
    if (spotifyId) {
      await admin.from("tracks").update({ spotify_link_id: spotifyId }).eq("id", id)
      found++
    }
    await sleep(80)
  }
  return found
}
