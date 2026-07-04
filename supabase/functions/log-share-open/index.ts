import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return new Response(JSON.stringify({ success: false }), { headers: corsHeaders })

  try {
    const { track_id, referrer, user_agent } = await req.json()
    if (!track_id) return new Response(JSON.stringify({ success: false }), { headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    await supabase.from("share_opens").insert({
      track_id,
      referrer: referrer || null,
      user_agent: user_agent || null,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
