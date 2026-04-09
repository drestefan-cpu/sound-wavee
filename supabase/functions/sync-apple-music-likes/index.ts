import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }
  return new Response(JSON.stringify({ success: true, count: 0, message: "Apple Music sync coming soon" }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
