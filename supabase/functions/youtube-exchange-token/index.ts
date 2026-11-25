import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }
  try {
    const { code, redirect_uri } = await req.json()
    if (!code || !redirect_uri) return json({ error: 'code and redirect_uri required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── Who is calling? Use the caller's Supabase session, not a user_id from the body ──
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user: caller } } = await supabase.auth.getUser(jwt)
    if (!caller) return json({ error: 'Not signed in' }, 401)

    // ── Exchange the Google OAuth code (this proves the caller owns the YouTube account) ──
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('YOUTUBE_CLIENT_ID')!,
        client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET')!,
        redirect_uri,
        grant_type: 'authorization_code',
      })
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return json({ error: 'Token exchange failed', detail: tokens.error_description || tokens.error }, 400)
    }

    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const channelData = await channelRes.json()
    const youtubeUserId: string | null = channelData.items?.[0]?.id || null
    const youtubeDisplayName = channelData.items?.[0]?.snippet?.title || null
    const youtubeAvatar = channelData.items?.[0]?.snippet?.thumbnails?.default?.url || null
    if (!youtubeUserId) return json({ error: 'No YouTube channel found for this Google account' }, 400)

    const tokenFields = {
      youtube_access_token: tokens.access_token,
      // Google only returns a refresh token on first consent — keep the old one otherwise
      ...(tokens.refresh_token ? { youtube_refresh_token: tokens.refresh_token } : {}),
      youtube_user_id: youtubeUserId,
    }

    // ── Is this channel already linked to a different PLAI account? ──
    const { data: owner } = await supabase
      .from('profiles')
      .select('id')
      .eq('youtube_user_id', youtubeUserId)
      .maybeSingle()
    const existingUserId: string | null = owner && owner.id !== caller.id ? owner.id : null

    if (existingUserId) {
      // A brand-new anonymous account with no likes = a returning user on a new device.
      // Sign them back into their existing account instead of leaving them in an empty one.
      const { count: callerLikes } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', caller.id)
      const isFreshAnonymous = caller.is_anonymous === true && (callerLikes ?? 0) === 0

      if (isFreshAnonymous) {
        await supabase.from('profiles').update(tokenFields as any).eq('id', existingUserId)

        // Create a one-time sign-in token for the existing account. generateLink needs an
        // email; anonymous accounts get the same device email setup-apple-pin uses.
        const { data: existingAuth, error: getErr } = await supabase.auth.admin.getUserById(existingUserId)
        if (getErr || !existingAuth?.user) throw getErr || new Error('Existing account not found')
        let email = existingAuth.user.email
        if (!email) {
          email = `${existingUserId}@plai.device`
          const { error: emailErr } = await supabase.auth.admin.updateUserById(existingUserId, { email, email_confirm: true })
          if (emailErr) throw emailErr
        }
        const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
        if (linkErr || !link?.properties?.hashed_token) throw linkErr || new Error('Could not create sign-in token')

        return json({
          success: true,
          youtube_user_id: youtubeUserId,
          existing_user_id: existingUserId,
          login_token_hash: link.properties.hashed_token,
        })
      }

      // The caller has their own account with data: move the YouTube link to them
      await supabase.from('profiles').update({
        youtube_access_token: null,
        youtube_refresh_token: null,
        youtube_user_id: null,
      } as any).eq('id', existingUserId)
    }

    // ── Attach YouTube to the caller's own profile ──
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerProfile) {
      await supabase.from('profiles').update(tokenFields as any).eq('id', caller.id)
    } else {
      await supabase.from('profiles').insert({
        id: caller.id,
        ...tokenFields,
        display_name: youtubeDisplayName,
        avatar_url: youtubeAvatar,
      } as any)
    }

    // No Spotify connection and still on the default play app → play songs on YouTube Music
    await supabase.from('profiles').update({ preferred_platform: 'youtube_music' } as any)
      .eq('id', caller.id).eq('preferred_platform', 'spotify').is('spotify_refresh_token', null)

    return json({ success: true, youtube_user_id: youtubeUserId, user_id: caller.id })
  } catch (err: any) {
    console.error('youtube-exchange-token error:', err)
    return json({ error: String(err?.message ?? err) }, 500)
  }
})
