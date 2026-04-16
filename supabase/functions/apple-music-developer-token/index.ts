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
  try {
    const teamId = Deno.env.get('APPLE_TEAM_ID')!
    const keyId = Deno.env.get('APPLE_KEY_ID')!
    const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')!

    const header = btoa(JSON.stringify({ alg: 'ES256', kid: keyId }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const now = Math.floor(Date.now() / 1000)
    const payload = btoa(JSON.stringify({
      iss: teamId, iat: now, exp: now + 15777000
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const data = `${header}.${payload}`

    function pemToBuffer(pem: string) {
      const base64 = pem
        .replace(/\\n/g, '\n')
        .replace(/-----[^-]+-----/g, '')
        .replace(/\s/g, '')
      const binary = atob(base64)
      const buffer = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
      return buffer.buffer
    }

    const key = await crypto.subtle.importKey(
      'pkcs8', pemToBuffer(privateKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['sign']
    )

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key, new TextEncoder().encode(data)
    )

    const token = `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
