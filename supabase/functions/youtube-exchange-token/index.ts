import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { code, redirect_uri, user_id } = await req.json()
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
      })
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: tokens }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get YouTube channel ID for this user
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const channelData = await channelRes.json()
    const youtubeUserId = channelData.items?.[0]?.id || null
    const youtubeDisplayName = channelData.items?.[0]?.snippet?.title || null
    const youtubeAvatar = channelData.items?.[0]?.snippet?.thumbnails?.default?.url || null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if a profile already exists with this YouTube user ID
    let existingUserId: string | null = null
    if (youtubeUserId) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('youtube_user_id', youtubeUserId)
        .maybeSingle()
      if (existingProfile) existingUserId = existingProfile.id
    }

    const targetUserId = existingUserId || user_id

    // Update or create profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (profile) {
      await supabase.from('profiles').update({
        youtube_access_token: tokens.access_token,
        youtube_refresh_token: tokens.refresh_token || null,
        youtube_user_id: youtubeUserId,
        display_name: profile ? undefined : youtubeDisplayName,
        avatar_url: profile ? undefined : youtubeAvatar,
      } as any).eq('id', targetUserId)
    } else {
      await supabase.from('profiles').insert({
        id: targetUserId,
        youtube_access_token: tokens.access_token,
        youtube_refresh_token: tokens.refresh_token || null,
        youtube_user_id: youtubeUserId,
        display_name: youtubeDisplayName,
        avatar_url: youtubeAvatar,
      } as any)
    }

    return new Response(JSON.stringify({ 
      success: true,
      youtube_user_id: youtubeUserId,
      existing_user_id: existingUserId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
