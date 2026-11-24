import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/auth.ts"
import { resolveTrackLinks } from "../_shared/links.ts"

// Fills in missing cross-platform links (Spotify ID, Apple Music ID) for up to 50 songs and returns
// them. Public on purpose: it only adds public catalogue IDs that are missing, using PLAI's own
// app credentials — no user data is read or changed. The app calls it when it meets a song whose
// links aren't known yet (e.g. a friend's Tidal song) so play/share buttons can open the exact song.

const MAX_IDS = 50
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.track_ids)
      ? [...new Set((body.track_ids as unknown[]).filter((v): v is string => typeof v === "string" && UUID_RE.test(v)))].slice(0, MAX_IDS)
      : []
    if (ids.length === 0) return jsonResponse({ error: "track_ids required (up to 50)" }, 400)

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const stats = await resolveTrackLinks(admin, ids, { spotifyLimit: MAX_IDS })

    const { data } = await admin
      .from("tracks")
      .select("id, spotify_track_id, spotify_link_id, apple_music_id")
      .in("id", ids)

    return jsonResponse({ success: true, stats, tracks: data || [] })
  } catch (err) {
    console.error("resolve-track-links error:", err)
    return jsonResponse({ error: String((err as any)?.message ?? err) }, 500)
  }
})
