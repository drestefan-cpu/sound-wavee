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
      .select("youtube_access_token")
      .eq("id", user_id)
      .single()

    if (!profile?.youtube_access_token) {
      return new Response(JSON.stringify({ success: false, error: "no token" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const accessToken = profile.youtube_access_token
    const threeSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

    let syncedCount = 0
    let pageToken: string | undefined = undefined
    let pageCount = 0
    let itemCount = 0
    let trackUpsertErrors: string[] = []
    let likeUpsertErrors: string[] = []

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
      detailsUrl.searchParams.set("part", "snippet")

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
