import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

/**
 * Apple Music sign-in (MusicKit JS), shared by the start screen and Settings.
 * Apple's sign-in opens in its own window and reports back to PLAI. Inside an iPhone home-screen
 * app that hand-back can get lost, so we stop waiting after a while and explain what to do,
 * instead of spinning forever.
 */

export type AppleAuthError = "cancelled" | "stuck" | "unavailable";

export class AppleMusicAuthError extends Error {
  constructor(public reason: AppleAuthError, message: string) {
    super(message);
  }
}

const AUTH_TIMEOUT_MS = 90_000;

/** True inside the home-screen (installed) version of PLAI */
export const isStandaloneApp = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

async function loadMusicKit() {
  const w = window as unknown as { MusicKit?: any };
  if (w.MusicKit) return w.MusicKit;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new AppleMusicAuthError("unavailable", "couldn't load Apple Music — check your connection"));
    document.head.appendChild(script);
  });
  return w.MusicKit;
}

/** Opens Apple's sign-in and returns the Apple Music user token. */
export async function authorizeAppleMusic(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/apple-music-developer-token`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  }).catch(() => null);
  const { token: developerToken } = (await res?.json().catch(() => ({}))) || {};
  if (!developerToken) throw new AppleMusicAuthError("unavailable", "couldn't reach Apple Music — try again in a minute");

  const MusicKit = await loadMusicKit();
  await MusicKit.configure({ developerToken, app: { name: "PLAI", build: "1.0" } });
  const music = MusicKit.getInstance();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppleMusicAuthError("stuck", "Apple's sign-in didn't finish")),
      AUTH_TIMEOUT_MS,
    );
  });

  try {
    const userToken: string | undefined = await Promise.race([music.authorize(), timeout]);
    if (!userToken) throw new AppleMusicAuthError("cancelled", "Apple Music sign-in cancelled");
    return userToken;
  } catch (err) {
    if (err instanceof AppleMusicAuthError) throw err;
    const msg = String((err as Error)?.message || err).toLowerCase();
    if (msg.includes("cancel") || msg.includes("abort") || msg.includes("denied")) {
      throw new AppleMusicAuthError("cancelled", "Apple Music sign-in cancelled");
    }
    throw new AppleMusicAuthError("stuck", "Apple's sign-in didn't finish");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
