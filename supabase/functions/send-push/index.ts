import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * Sends lock-screen notifications.
 *  { notification_id }   from the database trigger (cron secret): push one notification now
 *  { mode: "new_music" } from the 15-minute job (cron secret): one grouped push per friend who added music
 *  { mode: "test" }      from Settings (signed-in user): "notifications are on" to all their devices
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Note = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  data: Record<string, any> | null;
};
type Message = { title: string; body: string; url: string; tag: string };

const APP = "https://plai.delaneyprojects.xyz";

function describe(n: Note): Message {
  const d = n.data || {};
  const who = d.actor_display_name || (d.actor_username ? `@${d.actor_username}` : "someone");
  const song = d.track_title ? (d.track_artist ? `${d.track_title} — ${d.track_artist}` : d.track_title) : "";
  const profile = d.actor_username ? `/profile/${d.actor_username}` : "/notifications";
  switch (n.type) {
    case "recommendation":
      return {
        title: `${who} sent you a song`,
        body: [song, d.message ? `“${d.message}”` : ""].filter(Boolean).join("\n") || "tap to hear it",
        url: "/profile?tab=foryou",
        tag: `rec-${n.id}`,
      };
    case "rec_reaction":
      return { title: `${who} reacted ${d.emoji || ""} to the song you sent`.replace(/\s+/g, " "), body: song, url: "/notifications", tag: `recr-${n.id}` };
    case "reaction":
      return { title: `${who} reacted ${d.emoji || ""} to your song`.replace(/\s+/g, " "), body: song, url: "/notifications", tag: `react-${n.id}` };
    case "save":
      return {
        title: d.context === "recommendation" ? `${who} saved the song you sent` : `${who} saved a song from you`,
        body: song,
        url: "/notifications",
        tag: `save-${n.id}`,
      };
    case "follow":
      return { title: `${who} followed you`, body: "tap to see their music", url: profile, tag: `follow-${n.id}` };
    case "weekly_recap":
      return { title: "your week on PLAI", body: d.summary || "tap to see your week", url: "/feed?recap=1", tag: "recap" };
    case "new_music": {
      const count = Number(d.count) || 1;
      return {
        title: count === 1 ? `${who} added a new song` : `${who} added ${count} new songs`,
        body: count === 1 ? song || "tap to hear it" : song ? `latest: ${song}` : "tap to hear them",
        url: profile,
        tag: `music-${n.actor_id}`,
      };
    }
    default:
      return { title: "PLAI", body: "you have a new notification", url: "/notifications", tag: `n-${n.id}` };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    webpush.setVapidDetails(APP, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const fromCron = !!Deno.env.get("CRON_SECRET") && req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");

    // Send one message to every device of one person; forget devices that are gone
    const sendTo = async (userId: string, msg: Message) => {
      const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
      let sent = 0;
      for (const s of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...msg, url: msg.url.startsWith("/") ? msg.url : `/${msg.url}` }),
            { TTL: 60 * 60 * 24, urgency: "normal" },
          );
          sent++;
          await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("push failed", code, String(err?.body || err?.message || err).slice(0, 200));
        }
      }
      return sent;
    };

    // ── test from Settings ──
    if (body.mode === "test") {
      const authHeader = req.headers.get("Authorization") || "";
      const { data: { user } } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
      if (!user) return json({ error: "sign in first" }, 401);
      const sent = await sendTo(user.id, {
        title: "notifications are on ✓",
        body: "you'll hear when friends send you songs, react, or add new music",
        url: "/feed",
        tag: "test",
      });
      return json({ sent });
    }

    if (!fromCron) return json({ error: "unauthorized" }, 401);

    // ── one notification, straight away ──
    if (body.notification_id) {
      const { data: n } = await admin
        .from("notifications")
        .select("id, user_id, type, actor_id, data, pushed_at")
        .eq("id", body.notification_id)
        .maybeSingle();
      if (!n || n.pushed_at) return json({ sent: 0 });
      await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
      return json({ sent: await sendTo(n.user_id, describe(n as Note)) });
    }

    // ── grouped "added new music": wait until a friend has stopped adding for 10 minutes ──
    if (body.mode === "new_music") {
      const now = Date.now();
      const { data: notes } = await admin
        .from("notifications")
        .select("id, user_id, type, actor_id, data")
        .eq("type", "new_music")
        .eq("read", false)
        .is("pushed_at", null)
        .gte("created_at", new Date(now - 6 * 3600_000).toISOString())
        .lte("created_at", new Date(now - 10 * 60_000).toISOString())
        .limit(200);
      let sent = 0;
      for (const n of notes || []) {
        await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
        sent += await sendTo(n.user_id, describe(n as Note));
      }
      return json({ sent });
    }

    return json({ error: "nothing to do" }, 400);
  } catch (err) {
    console.error("send-push failed", err);
    return json({ error: "send failed" }, 500);
  }
});
