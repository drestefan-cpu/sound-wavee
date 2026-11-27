import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsonResponse, corsHeaders } from "../_shared/auth.ts"
import { generateAppleDeveloperToken, resolveTrackLinks } from "../_shared/links.ts"

// Keeps a copy of an Apple Music country's "top songs" chart in chart_tracks, for Discover's
// "top songs in <country>" section. Body: { storefront: "gb" } (defaults to "us"). The app calls this when it opens Discover; it only fetches
// from Apple when the stored chart is more than 12 hours old, so repeat calls are cheap.
// Every chart song becomes a normal PLAI track (so it can be saved and shared), and its
// Spotify / Tidal links are filled in in the background.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

// Countries the app offers (same list as src/lib/chartCountry.ts)
const STOREFRONTS = new Set([
  "us", "gb", "ca", "au", "nz", "ie", "de", "fr", "es", "it", "nl", "be", "se", "no", "dk", "fi", "pt", "at",
  "ch", "pl", "cz", "gr", "tr", "il", "ae", "sa", "eg", "za", "ng", "ke", "gh", "in", "jp", "kr", "cn", "hk",
  "tw", "sg", "my", "ph", "id", "th", "vn", "br", "mx", "ar", "co", "cl", "pe", "jm", "tt", "pr", "do",
])
const MAX_AGE_HOURS = 12
const SIZE = 25

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const body = await req.json().catch(() => ({}))
    const requested = String(body?.storefront || "us").toLowerCase()
    const storefront = STOREFRONTS.has(requested) ? requested : "us"
    const CHART = `apple-${storefront}-top-songs`

    const { data: latest } = await admin
      .from("chart_tracks")
      .select("fetched_at")
      .eq("chart", CHART)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.fetched_at && Date.now() - new Date(latest.fetched_at).getTime() < MAX_AGE_HOURS * 3_600_000) {
      return jsonResponse({ fresh: true })
    }

    const token = await generateAppleDeveloperToken()
    if (!token) return jsonResponse({ error: "apple music isn't configured" }, 500)

    const res = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/charts?types=songs&limit=${SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return jsonResponse({ error: `apple music chart unavailable (${res.status})` }, 502)
    const chart = await res.json()
    const songs: any[] = chart?.results?.songs?.[0]?.data || []
    if (songs.length === 0) return jsonResponse({ error: "apple music returned an empty chart" }, 502)

    const trackIds: string[] = []
    for (const song of songs) {
      const a = song?.attributes
      if (!song?.id || !a?.name) continue
      const appleId = String(song.id)
      const isrc: string | null = a.isrc || null

      // Reuse an existing PLAI track (same Apple ID, or same recording by ISRC)
      let { data: track } = await admin.from("tracks").select("id").eq("apple_music_id", appleId).limit(1).maybeSingle()
      if (!track && isrc) {
        ;({ data: track } = await admin
          .from("tracks")
          .select("id")
          .eq("isrc", isrc)
          .order("created_at")
          .limit(1)
          .maybeSingle())
      }
      if (!track) {
        const { data: inserted, error } = await admin
          .from("tracks")
          .insert({
            spotify_track_id: `apple:${appleId}`,
            apple_music_id: appleId,
            isrc,
            title: a.name,
            artist: a.artistName || "Unknown",
            album: a.albumName || null,
            album_art_url: a.artwork?.url ? String(a.artwork.url).replace("{w}", "600").replace("{h}", "600") : null,
            track_source: "chart",
          })
          .select("id")
          .single()
        if (error || !inserted) continue
        track = inserted
      }
      trackIds.push(track.id)
    }

    if (trackIds.length === 0) return jsonResponse({ error: "couldn't store the chart" }, 500)

    const fetchedAt = new Date().toISOString()
    await admin.from("chart_tracks").delete().eq("chart", CHART)
    const { error: chartError } = await admin
      .from("chart_tracks")
      .insert(trackIds.map((track_id, i) => ({ chart: CHART, position: i + 1, track_id, fetched_at: fetchedAt })))
    if (chartError) {
      console.error("chart insert failed", chartError)
      return jsonResponse({ error: "couldn't store the chart" }, 500)
    }

    // Fill in Spotify / Tidal links after replying
    EdgeRuntime.waitUntil(resolveTrackLinks(admin, trackIds, { spotifyLimit: SIZE }).catch(() => {}))

    return jsonResponse({ refreshed: true, songs: trackIds.length })
  } catch (err) {
    console.error("refresh-charts failed", err)
    return jsonResponse({ error: "chart refresh failed" }, 500)
  }
})
