import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Load user's Spotify tokens
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("spotify_access_token, spotify_refresh_token")
      .eq("id", user_id)
      .single()

    if (!profile?.spotify_access_token) {
      return new Response(JSON.stringify({ error: "No Spotify token found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let accessToken = profile.spotify_access_token

    // Helper: refresh Spotify token if expired
    const refreshSpotifyToken = async (): Promise<boolean> => {
      if (!profile.spotify_refresh_token) return false
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.spotify_refresh_token,
          client_id: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
          client_secret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
        }),
      })
      const refreshData = await refreshRes.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabaseAdmin.from("profiles").update({ spotify_access_token: accessToken }).eq("id", user_id)
        return true
      }
      return false
    }

    // Helper: Spotify fetch with auto-refresh
    const spotifyFetch = async (url: string): Promise<any> => {
      let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.status === 401) {
        const refreshed = await refreshSpotifyToken()
        if (refreshed) {
          res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        }
      }
      if (!res.ok) return null
      return res.json()
    }

    // Load user's followed artists from our DB
    const { data: followedRows } = await supabaseAdmin
      .from("user_followed_artists")
      .select("artist_name")
      .eq("user_id", user_id)

    // Split comma-separated entries (handles legacy multi-artist rows pre-fix)
    const artistNames: string[] = [...new Set(
      ((followedRows || []) as any[])
        .flatMap((r: any) =>
          typeof r.artist_name === "string"
            ? r.artist_name.split(/\s*,\s*/).map((n: string) => n.trim()).filter(Boolean)
            : []
        )
    )]

    if (artistNames.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "no followed artists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 60-day cutoff
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 60)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    let syncedCount = 0

    for (const artistName of artistNames) {
      // Search Spotify for the artist
      const searchData = await spotifyFetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`
      )
      const artist = searchData?.artists?.items?.[0]
      if (!artist?.id) continue

      // Reject fuzzy mismatches — Spotify returns popularity-ranked results, not exact matches
      const normalize = (s: string) => s.toLowerCase().trim()
      const searchedNorm = normalize(artistName)
      const returnedNorm = normalize(artist.name)
      if (returnedNorm !== searchedNorm && !returnedNorm.includes(searchedNorm)) continue

      // Reject non-music entities (podcast studios, labels, etc.) — music artists
      // always have genre tags; production companies and podcast shows never do
      if (!artist.genres || artist.genres.length === 0) continue

      // Get artist's recent releases (albums + singles)
      const albumsData = await spotifyFetch(
        `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=US`
      )
      if (!albumsData?.items) continue

      for (const album of albumsData.items) {
        // Skip releases older than 60 days
        if (!album.release_date || album.release_date < cutoffStr) continue

        // Get tracks from this album/single
        const tracksData = await spotifyFetch(
          `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=5&market=US`
        )
        if (!tracksData?.items) continue

        for (const track of tracksData.items) {
          if (!track?.id) continue

          const { error } = await supabaseAdmin
            .from("artist_releases")
            .upsert({
              spotify_track_id: track.id,
              title: track.name,
              artist_name: artistName,
              album: album.name,
              album_art_url: album.images?.[0]?.url || null,
              release_date: album.release_date,
            }, { onConflict: "spotify_track_id" })

          if (!error) syncedCount++
        }
      }
    }

    // Delete releases older than 60 days to keep the table clean
    await supabaseAdmin
      .from("artist_releases")
      .delete()
      .lt("release_date", cutoffStr)

    return new Response(JSON.stringify({ synced: syncedCount, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
