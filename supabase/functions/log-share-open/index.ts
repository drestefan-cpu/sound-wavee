import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Records one open of a shared song page. `from` is the sharer's username from the link
// (?from=…), so sharers can see how often their links get opened.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const ok = (success: boolean) =>
  new Response(JSON.stringify({ success }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return ok(false)

  try {
    const { track_id, referrer, user_agent, from, viewer_id } = await req.json()
    if (typeof track_id !== "string" || !/^[0-9a-f-]{36}$/i.test(track_id)) return ok(false)

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    let sharerId: string | null = null
    if (typeof from === "string" && /^[a-z0-9._-]{1,40}$/i.test(from)) {
      const { data } = await supabase.from("profiles").select("id").ilike("username", from).maybeSingle()
      sharerId = data?.id || null
    }
    // Sharers opening their own link don't count
    if (sharerId && typeof viewer_id === "string" && viewer_id === sharerId) return ok(true)

    await supabase.from("share_opens").insert({
      track_id,
      sharer_id: sharerId,
      referrer: typeof referrer === "string" ? referrer.slice(0, 500) : null,
      user_agent: typeof user_agent === "string" ? user_agent.slice(0, 500) : null,
    })
    return ok(true)
  } catch {
    return ok(false)
  }
})
