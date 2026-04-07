import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { code_challenge, redirect_uri } = await req.json()
    const clientId = Deno.env.get("TIDAL_CLIENT_ID")

    if (!clientId) {
      return new Response(JSON.stringify({ error: "TIDAL_CLIENT_ID not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri,
      scope: "r_usr w_usr r_sub collection.read",
      code_challenge,
      code_challenge_method: "S256",
    })

    return new Response(JSON.stringify({ url: `https://login.tidal.com/authorize?${params}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
