import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }
  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ success: false, error: "missing user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: profile } = await supabase
      .from("profiles")
      .select("youtube_access_token, youtube_refresh_token")
      .eq("id", user_id)
      .single()

    if (!profile?.youtube_access_token) {
      return new Response(JSON.stringify({ success: false, error: "no token" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    let accessToken = profile.youtube_access_token
    const threeSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

    let syncedCount = 0
    let pageToken: string | undefined = undefined
    let pageCount = 0
    let itemCount = 0
    let trackUpsertErrors: string[] = []
    let likeUpsertErrors: string[] = []

    // Remove this user's YouTube likes older than 365 days before re-syncing.
    const { data: oldYtLikes, error: cleanupQueryErr } = await supabase
      .from("likes")
      .select("track_id, tracks!inner(spotify_track_id)")
      .eq("user_id", user_id)
      .lt("liked_at", threeSixtyFiveDaysAgo.toISOString())
      .like("tracks.spotify_track_id", "yt:%")

    if (cleanupQueryErr) {
      console.error("YouTube cleanup query failed:", cleanupQueryErr.message)
    } else if (oldYtLikes && oldYtLikes.length > 0) {
      const oldIds = oldYtLikes.map((r: any) => r.track_id)
      const { error: cleanupDeleteErr } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", user_id)
        .in("track_id", oldIds)
      if (cleanupDeleteErr) console.error("YouTube cleanup delete failed:", cleanupDeleteErr.message)
      else console.log(`Cleaned up ${oldIds.length} YouTube likes older than 365 days`)
    }

    // Clean up any YouTube Shorts already in this user's likes.
    // Fetches duration for all existing yt: tracks via the YouTube API and
    // deletes likes for anything ≤ 60 seconds.
    const { data: existingYtLikes } = await supabase
      .from("likes")
      .select("track_id, tracks!inner(spotify_track_id)")
      .eq("user_id", user_id)
      .like("tracks.spotify_track_id", "yt:%")

    if (existingYtLikes && existingYtLikes.length > 0) {
      const videoIdToTrackId: Record<string, string> = {}
      for (const row of existingYtLikes) {
        const spId = (row as any).tracks?.spotify_track_id as string
        const videoId = spId?.replace("yt:", "")
        if (videoId) videoIdToTrackId[videoId] = row.track_id
      }

      const videoIds = Object.keys(videoIdToTrackId)
      const shortTrackIds: string[] = []

      for (let i = 0; i < videoIds.length; i += 50) {
        const chunk = videoIds.slice(i, i + 50)
        const dUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
        dUrl.searchParams.set("id", chunk.join(","))
        dUrl.searchParams.set("part", "contentDetails")
        const dRes = await fetch(dUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!dRes.ok) continue
        const dData = await dRes.json()
        for (const video of (dData.items || [])) {
          const dur = video.contentDetails?.duration || ""
          const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          const secs = m
            ? (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0")
            : 999
          if (secs <= 60) {
            const trackId = videoIdToTrackId[video.id]
            if (trackId) shortTrackIds.push(trackId)
          }
        }
      }

      if (shortTrackIds.length > 0) {
        const { error: shortsDeleteErr } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user_id)
          .in("track_id", shortTrackIds)
        if (shortsDeleteErr) console.error("Shorts cleanup delete failed:", shortsDeleteErr.message)
        else console.log(`Cleaned up ${shortTrackIds.length} YouTube Shorts from likes`)
      }
    }

    const { data: exclusionRows } = await supabase
      .from("collection_exclusions")
      .select("track_id")
      .eq("user_id", user_id)

    const excludedTrackIds = new Set((exclusionRows || []).map((row: any) => row.track_id))

    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
      url.searchParams.set("playlistId", "LL")
      url.searchParams.set("part", "snippet,contentDetails")
      url.searchParams.set("maxResults", "50")
      if (pageToken) url.searchParams.set("pageToken", pageToken)

      const ytRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (ytRes.status === 401 && (profile as any).youtube_refresh_token) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: (profile as any).youtube_refresh_token,
            client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
            client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
          })
        })
        const refreshData = await refreshRes.json()
        if (refreshData.access_token) {
          accessToken = refreshData.access_token
          await supabase.from("profiles").update({ youtube_access_token: accessToken } as any).eq("id", user_id)
          continue
        }
      }

      if (!ytRes.ok) {
        const errText = await ytRes.text()
        console.error("YouTube API error:", ytRes.status, errText)
        return new Response(JSON.stringify({ success: false, error: `YouTube API ${ytRes.status}: ${errText}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      const ytData = await ytRes.json()
      const items = ytData.items || []
      pageCount++
      itemCount += items.length
      console.log(`Page ${pageCount}: ${items.length} items`)

      const videoIds = items.map((item: any) => item.contentDetails?.videoId).filter(Boolean)
      if (videoIds.length === 0) break

      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
      detailsUrl.searchParams.set("id", videoIds.join(","))
      detailsUrl.searchParams.set("part", "snippet,contentDetails")

      const detailsRes = await fetch(detailsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const detailsData = await detailsRes.json()
      console.log(`Got ${detailsData.items?.length} video details`)

      const videoMap: Record<string, any> = {}
      for (const v of (detailsData.items || [])) {
        videoMap[v.id] = v
      }

      for (const item of items) {
        const videoId = item.contentDetails?.videoId
        if (!videoId) continue

        const video = videoMap[videoId]
        if (!video) { console.log(`No video details for ${videoId}`); continue }

        if (video.snippet?.categoryId !== "10") continue

        const title = video.snippet.title
        const artist = video.snippet.channelTitle
        const albumArt = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || null
        const likedAt = item.snippet?.publishedAt

        // YouTube Liked Videos returns newest-first, so once we hit something
        // older than 365 days everything remaining is older — safe to stop.
        if (likedAt && new Date(likedAt) < threeSixtyFiveDaysAgo) {
          pageToken = undefined
          break
        }

        // Skip YouTube Shorts (≤ 60 seconds). Duration comes from contentDetails
        // as ISO 8601, e.g. "PT30S" or "PT1M". Default 999 so missing data passes.
        const duration = video.contentDetails?.duration || ""
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        const totalSeconds = durationMatch
          ? (parseInt(durationMatch[1] || "0") * 3600)
            + (parseInt(durationMatch[2] || "0") * 60)
            + parseInt(durationMatch[3] || "0")
          : 999
        if (totalSeconds <= 60) continue

        console.log(`Upserting track: ${title} by ${artist}, videoId: ${videoId}`)

        const { data: track, error: trackErr } = await supabase
          .from("tracks")
          .upsert({
            title,
            artist,
            album_art_url: albumArt,
            youtube_video_id: videoId,
            spotify_track_id: `yt:${videoId}`,
          }, { onConflict: "youtube_video_id" })
          .select("id")
          .single()

        if (trackErr || !track) {
          console.error(`Track upsert error for ${videoId}:`, JSON.stringify(trackErr))
          trackUpsertErrors.push(`${videoId}: ${trackErr?.message}`)
          continue
        }

        console.log(`Track upserted with id: ${track.id}`)

        if (excludedTrackIds.has(track.id)) {
          await supabase
            .from("collection_exclusions")
            .delete()
            .eq("user_id", user_id)
            .eq("track_id", track.id)

          excludedTrackIds.delete(track.id)
        }

        const { error: likeErr } = await supabase
          .from("likes")
          .upsert({ user_id, track_id: track.id, liked_at: likedAt }, { onConflict: "user_id,track_id" })

        if (likeErr) {
          console.error(`Like upsert error:`, JSON.stringify(likeErr))
          likeUpsertErrors.push(likeErr.message)
          continue
        }

        syncedCount++
      }

      pageToken = ytData.nextPageToken
    } while (pageToken)

    await supabase
      .from("profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", user_id)

    return new Response(JSON.stringify({ 
      success: true, 
      count: syncedCount,
      debug: { pageCount, itemCount, trackUpsertErrors, likeUpsertErrors }
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("sync-youtube-likes error:", err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
