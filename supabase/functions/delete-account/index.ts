import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Settings → delete my account. Deletes the signed-in person's account and everything tied to it
 * (profile, synced songs, music-app connections, follows, notifications, replies, photos).
 * The caller must send their own username back as confirmation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "sign in first" }, 401);

    const { confirm } = await req.json().catch(() => ({}));
    const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
    const expected = profile?.username || "delete";
    if (String(confirm || "").trim().toLowerCase().replace(/^@/, "") !== expected.toLowerCase()) {
      return json({ error: `type ${expected} to confirm` }, 400);
    }

    // Profile photos
    const { data: files } = await admin.storage.from("avatars").list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));

    // The sign-in itself; everything else is removed with it (database cascades)
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("delete-account failed", error);
      return json({ error: "couldn't delete your account — try again, or email andre@delaneyprojects.xyz" }, 500);
    }
    return json({ deleted: true });
  } catch (err) {
    console.error("delete-account failed", err);
    return json({ error: "couldn't delete your account — try again" }, 500);
  }
});
