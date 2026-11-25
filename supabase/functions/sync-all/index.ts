import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Background sync for everyone (run by pg_cron every 2 hours): for each person with a connected
// music app, runs that app's sync function as a trusted server call. Without this, a person's new
// likes only reached their friends' feeds when they opened PLAI themselves.
// Protected by a shared secret (CRON_SECRET), not a user login.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const PLATFORMS = [
  { fn: "sync-spotify-likes", column: "spotify_refresh_token" },
  { fn: "sync-apple-music-likes", column: "apple_music_user_token" },
  { fn: "sync-tidal-likes", column: "tidal_refresh_token" },
  { fn: "sync-youtube-likes", column: "youtube_refresh_token" },
  { fn: "spotify-playlist", column: "spotify_playlist_id" }, // public-playlist fallback for Spotify
] as const

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runAll() {
  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey)
  const started = Date.now()

  const { data: profiles } = await admin
    .from("profiles")
    .select(`id, username, ${PLATFORMS.map((p) => p.column).join(", ")}`)
    .not("username", "is", null)

  const results: string[] = []
  for (const profile of (profiles || []) as Record<string, string | null>[]) {
    for (const p of PLATFORMS) {
      if (!profile[p.column]) continue
      if (Date.now() - started > 130_000) {
        results.push("stopped: out of time")
        console.log("sync-all", results.join(" | "))
        return
      }
      try {
        const res = await fetch(`${url}/functions/v1/${p.fn}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: profile.id }),
        })
        const platform = p.fn.replace("sync-", "").replace("-likes", "")
        const detail = (await res.text().catch(() => "")).slice(0, 300)
        results.push(`${profile.username} ${platform}: ${res.status}`)
        await admin.from("sync_log").insert({ user_id: profile.id, platform, status: res.status, detail })
      } catch (e) {
        results.push(`${profile.username} ${p.fn}: failed ${String(e).slice(0, 60)}`)
        await admin.from("sync_log").insert({ user_id: profile.id, platform: p.fn, status: 0, detail: String(e).slice(0, 300) })
      }
      await sleep(500)
    }
  }
  // Genres for any new songs (taste match uses them)
  try {
    const res = await fetch(`${url}/functions/v1/fill-genres`, {
      method: "POST",
      headers: { "x-cron-secret": Deno.env.get("CRON_SECRET") || "" },
    })
    results.push(`genres: ${res.status} ${(await res.text()).slice(0, 80)}`)
  } catch (e) {
    results.push(`genres: failed ${String(e).slice(0, 60)}`)
  }
  console.log("sync-all", results.join(" | "))
  await admin.from("sync_log").delete().lt("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
}

serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET")
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "not allowed" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  EdgeRuntime.waitUntil(runAll().catch((e) => console.error("sync-all failed", e)))
  return new Response(JSON.stringify({ started: true }), { headers: { "Content-Type": "application/json" } })
})
