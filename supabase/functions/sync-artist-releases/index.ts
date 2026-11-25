import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { requireCaller, jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { getSpotifyAppToken } from "../_shared/spotify.ts"

// Finds new songs (last 60 days) from the artists a person follows on PLAI and stores them in
// artist_releases, plus a tracks row for each so they can be saved and shared straight away.
// Uses the person's own Spotify connection when they have one, otherwise PLAI's app token, so it
// works for Apple Music, Tidal and YouTube listeners too. Runs at most once every 12 hours per person.

const WINDOW_DAYS = 60
const MIN_HOURS_BETWEEN_SYNCS = 12
const TIME_BUDGET_MS = 110_000

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const started = Date.now()

  try {
    const body = await req.json().catch(() => ({}))
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const caller = await requireCaller(req, supabaseAdmin, body.user_id)
    if (!caller.ok) return caller.response
    const user_id = caller.userId

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("spotify_access_token, spotify_refresh_token, releases_synced_at")
      .eq("id", user_id)
      .single()

    if (profile?.releases_synced_at && !body.force) {
      const hours = (Date.now() - new Date(profile.releases_synced_at).getTime()) / 3_600_000
      if (hours < MIN_HOURS_BETWEEN_SYNCS) return jsonResponse({ skipped: true, reason: "synced recently" })
    }

    // ── Spotify access: the person's token if connected, else PLAI's app token ──
    let accessToken: string | null = profile?.spotify_access_token || null
    let usingUserToken = !!accessToken
    if (!accessToken) accessToken = await getSpotifyAppToken()
    if (!accessToken) return jsonResponse({ error: "couldn't reach Spotify" }, 502)

    const refreshUserToken = async (): Promise<boolean> => {
      if (!profile?.spotify_refresh_token) return false
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.spotify_refresh_token,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.access_token) return false
      accessToken = data.access_token
      await supabaseAdmin.from("profiles").update({ spotify_access_token: data.access_token }).eq("id", user_id)
      return true
    }

    const spotifyFetch = async (url: string): Promise<any> => {
      let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.status === 401) {
        // Expired: refresh the person's token, or fall back to the app token
        const ok = usingUserToken ? await refreshUserToken() : false
        if (!ok) {
          accessToken = await getSpotifyAppToken()
          usingUserToken = false
        }
        if (accessToken) res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      }
      if (res.status === 429) {
        const wait = Math.min(Number(res.headers.get("Retry-After") || "2"), 10)
        await new Promise((r) => setTimeout(r, wait * 1000))
        res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      }
      if (!res.ok) return null
      return res.json()
    }

    // ── Followed artists ──
    const { data: followedRows } = await supabaseAdmin
      .from("user_followed_artists")
      .select("artist_name")
      .eq("user_id", user_id)

    const artistNames: string[] = [...new Set(
      ((followedRows || []) as { artist_name: string | null }[]).flatMap((r) =>
        typeof r.artist_name === "string"
          ? r.artist_name.split(/\s*,\s*/).map((n) => n.trim()).filter(Boolean)
          : [],
      ),
    )]
    // Random order, so if a very long list runs out of time, the next visit covers different artists
    for (let i = artistNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[artistNames[i], artistNames[j]] = [artistNames[j], artistNames[i]]
    }

    if (artistNames.length === 0) {
      await supabaseAdmin.from("profiles").update({ releases_synced_at: new Date().toISOString() }).eq("id", user_id)
      return jsonResponse({ synced: 0, message: "no followed artists" })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()

    let syncedCount = 0
    let artistsChecked = 0
    let outOfTime = false

    for (const artistName of artistNames) {
      if (Date.now() - started > TIME_BUDGET_MS) { outOfTime = true; break }
      artistsChecked++

      const searchData = await spotifyFetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
      )
      const artist = searchData?.artists?.items?.[0]
      if (!artist?.id) continue

      // Search is popularity-ranked, not exact: only accept the same (or containing) name
      const searchedNorm = normalize(artistName)
      const returnedNorm = normalize(artist.name)
      if (returnedNorm !== searchedNorm && !returnedNorm.includes(searchedNorm)) continue
      // Podcast studios and labels have no genre tags (when Spotify provides genres at all)
      if (Array.isArray(artist.genres) && artist.genres.length === 0 && (artist.popularity ?? 100) < 20) continue

      const albumsData = await spotifyFetch(
        `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=US`,
      )
      if (!albumsData?.items) continue

      for (const album of albumsData.items) {
        if (!album.release_date || album.release_date < cutoffStr) continue

        const tracksData = await spotifyFetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=5&market=US`)
        if (!tracksData?.items) continue

        const albumArt = album.images?.[0]?.url || null
        for (const track of tracksData.items) {
          if (!track?.id) continue

          const { error } = await supabaseAdmin.from("artist_releases").upsert({
            spotify_track_id: track.id,
            title: track.name,
            artist_name: artistName,
            album: album.name,
            album_art_url: albumArt,
            release_date: album.release_date,
          }, { onConflict: "spotify_track_id" })
          if (error) continue
          syncedCount++

          // Make sure the song exists in PLAI's catalogue so it can be saved and shared
          const { data: existing } = await supabaseAdmin
            .from("tracks")
            .select("id")
            .or(`spotify_track_id.eq.${track.id},spotify_link_id.eq.${track.id}`)
            .limit(1)
            .maybeSingle()
          if (!existing) {
            await supabaseAdmin.from("tracks").insert({
              spotify_track_id: track.id,
              title: track.name,
              artist: (track.artists || []).map((a: { name: string }) => a.name).join(", ") || artistName,
              album: album.name,
              album_art_url: albumArt,
              track_source: "release",
            })
          }
        }
      }
    }

    // Keep the table to the release window
    await supabaseAdmin.from("artist_releases").delete().lt("release_date", cutoffStr)

    // Only mark the sync done if every artist was checked; otherwise the next visit continues
    if (!outOfTime) {
      await supabaseAdmin.from("profiles").update({ releases_synced_at: new Date().toISOString() }).eq("id", user_id)
    }

    return jsonResponse({
      success: true,
      synced: syncedCount,
      artistsChecked,
      artistsTotal: artistNames.length,
      source: usingUserToken ? "your spotify" : "plai",
    })
  } catch (err) {
    console.error("sync-artist-releases failed", err)
    return jsonResponse({ error: "release sync failed" }, 500)
  }
})
