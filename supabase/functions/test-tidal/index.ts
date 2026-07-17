import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const clientId = Deno.env.get("TIDAL_CLIENT_ID")!
    const clientSecret = Deno.env.get("TIDAL_CLIENT_SECRET")!

    const tokenRes = await fetch("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: "grant_type=client_credentials",
    })
    const tokenData = await tokenRes.json()
    const token = tokenData.access_token

    // Try multiple endpoint formats
    const endpoints = [
      `https://openapi.tidal.com/tracks?isrc=USAT22600815&countryCode=US`,
      `https://openapi.tidal.com/v2/tracks?filter[isrc]=USAT22600815&countryCode=US`,
      `https://api.tidal.com/v1/tracks?isrc=USAT22600815&countryCode=US`,
      `https://openapi.tidal.com/tracks/USAT22600815?countryCode=US`,
    ]

    const results: any = {}
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        headers: { 
          Authorization: `Bearer ${token}`,
          accept: "application/vnd.tidal.v1+json"
        }
      })
      const text = await res.text()
      results[endpoint] = { status: res.status, body: text.slice(0, 200) }
    }

    return new Response(JSON.stringify(results, null, 2), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
