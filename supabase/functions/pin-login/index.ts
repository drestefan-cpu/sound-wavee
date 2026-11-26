import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sign in with username + PIN, for every kind of account:
 *  - Apple Music / Tidal accounts (their sign-in email is <id>@plai.device)
 *  - Spotify / Google accounts that set a PIN as a spare way in (their real email, never sent to the app)
 * After 5 wrong PINs a username is locked for 15 minutes.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || "").toLowerCase().trim().replace(/^@/, "");
    const pin = String(body.pin || "");
    if (!username || !/^(\d{4}|\d{6})$/.test(pin)) return json({ error: "enter your username and PIN" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Locked after too many wrong tries?
    const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from("pin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", username)
      .eq("ok", false)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_FAILS) {
      return json({ error: `too many wrong tries — wait ${LOCK_MINUTES} minutes and try again` }, 429);
    }

    const fail = async () => {
      await admin.from("pin_login_attempts").insert({ username, ok: false });
      return json({ error: "wrong username or PIN" }, 401);
    };

    const { data: profile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!profile) return await fail();
    const { data: found } = await admin.auth.admin.getUserById(profile.id);
    const email = found?.user?.email;
    if (!email) return await fail();

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signedIn, error } = await anon.auth.signInWithPassword({ email, password: pin });
    if (error || !signedIn.session) return await fail();

    await admin.from("pin_login_attempts").insert({ username, ok: true });
    // Old tries are no longer needed once someone gets in
    await admin.from("pin_login_attempts").delete().eq("username", username).lt("created_at", since);

    return json({
      access_token: signedIn.session.access_token,
      refresh_token: signedIn.session.refresh_token,
    });
  } catch (err) {
    console.error("pin-login failed", err);
    return json({ error: "sign in failed — try again" }, 500);
  }
});
