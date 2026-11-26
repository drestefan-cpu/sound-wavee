import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders })
    }

    // Identify calling user from their JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 6 digits = 1,000,000 combinations (4 digits was only 10,000 — too easy to guess)
    const { pin } = await req.json()
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return new Response(JSON.stringify({ error: 'PIN must be exactly 6 digits' }), { status: 400, headers: corsHeaders })
    }

    // Admin client — sets email + password on the user, bypassing email confirmation
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Use a deterministic device email derived from the user's UUID.
    // signInWithPassword({email, password: pin}) is then used for return visits.
    // Spotify/Google accounts keep their real email: the PIN is just a spare way in (see pin-login)
    const hasRealEmail = !!user.email && !user.email.endsWith('@plai.device')
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      hasRealEmail
        ? { password: pin }
        : { email: `${user.id}@plai.device`, email_confirm: true, password: pin },
    )

    if (updateError) {
      console.error('setup-apple-pin update failed', updateError)
      const m = String(updateError.message || '')
      const reason = /password/i.test(m)
        ? "PLAI's sign-in settings rejected the PIN (password rules) — tell the PLAI owner"
        : "couldn't save your PIN — please try again"
      return new Response(JSON.stringify({ error: reason }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('setup-apple-pin failed', err)
    return new Response(JSON.stringify({ error: "couldn't save your PIN — please try again" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
