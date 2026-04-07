import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { code, code_verifier, redirect_uri, user_id } = await req.json()
    const clientId = Deno.env.get("TIDAL_CLIENT_ID")!

    const tokenRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: clientId,
        code_verifier,
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: "Token exchange failed", detail: tokens }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    await supabaseAdmin.from("profiles").update({
      tidal_access_token: tokens.access_token,
      tidal_refresh_token: tokens.refresh_token || null,
    }).eq("id", user_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
