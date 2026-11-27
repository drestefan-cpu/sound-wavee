import { supabase } from "@/integrations/supabase/client";
import { isIOS, isStandaloneApp } from "@/lib/appleMusic";

/**
 * Lock-screen notifications. Each device turns them on separately; the subscription is saved to
 * push_subscriptions and the send-push function delivers alerts to it.
 * On iPhone they only work in the home-screen app (iOS 16.4+), not in Safari.
 */

// Public half of PLAI's push key (safe to ship; the private half is a function secret)
const VAPID_PUBLIC_KEY = "BIwLW2uRqz7OrD74_HXGGjbPiWw8pUAOFFcWD-UPBx1Zsk_GHVabXpk7tH6QkgC7VGMvolf2r0Cma_jekcI8qbw";

export type PushState = "on" | "off" | "blocked" | "needs-home-screen" | "unsupported";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ]);
  return reg as ServiceWorkerRegistration | null;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIOS() && !isStandaloneApp() ? "needs-home-screen" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

const toKey = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const deviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "browser";
};

/** Must be called from a tap (browsers only allow the permission prompt then). */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await registration();
  if (!reg) throw new Error("notifications aren't ready yet — reload PLAI and try again");
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const { error } = await (supabase as any).rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_device: deviceName(),
  });
  if (error) throw new Error("couldn't turn on notifications — try again");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions" as any).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

/** Keep this device's subscription linked to whoever is signed in (e.g. after switching accounts) */
export async function refreshPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const j = sub.toJSON();
  await (supabase as any).rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_device: deviceName(),
  });
}

export async function sendTestPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("send-push", { body: { mode: "test" } });
  if (error) throw new Error("couldn't send a test — try again");
  return (data as { sent?: number })?.sent ?? 0;
}
