import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

async function getMusicKitInstance(): Promise<any | null> {
  try {
    // Load MusicKit JS script if not already present
    await new Promise<void>((resolve, reject) => {
      if ((window as any).MusicKit) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("MusicKit load failed"));
      document.head.appendChild(script);
    });

    const MK = (window as any).MusicKit;

    // If already configured and authorized, return the instance directly
    try {
      const existing = MK.getInstance();
      if (existing?.isAuthorized) return existing;
    } catch {
      // getInstance() throws if not yet configured — that's fine
    }

    // Need to configure before we can use it
    const res = await fetch(`${SUPABASE_URL}/functions/v1/apple-music-developer-token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const { token: developerToken } = await res.json();
    if (!developerToken) return null;

    await MK.configure({ developerToken, app: { name: "PLAI", build: "1.0" } });
    const music = MK.getInstance();

    // Only proceed if user has previously authorized — don't prompt mid-save
    if (!music?.isAuthorized) return null;
    return music;
  } catch {
    return null;
  }
}

/**
 * Adds a track to the current user's Apple Music library.
 * Fire-and-forget safe — all errors are swallowed.
 * Only runs if MusicKit is loaded and the user is already authorized.
 */
export async function addToAppleMusicLibrary(title: string, artist: string): Promise<void> {
  const music = await getMusicKitInstance();
  if (!music) return;

  try {
    const storefront = (music.storefrontId as string | undefined) || "us";
    const term = `${title} ${artist}`;

    // Search catalog for the best matching song
    const searchRes = await music.api.music(`/v1/catalog/${storefront}/search`, {
      parameters: { term, types: "songs", limit: "1" },
    });

    const catalogId: string | undefined =
      searchRes?.data?.results?.songs?.data?.[0]?.id;
    if (!catalogId) return;

    // POST to /v1/me/library with ids[songs] query param
    await music.api.music(`/v1/me/library`, {
      fetchOptions: { method: "POST" },
      parameters: { "ids[songs]": catalogId },
    });
  } catch {
    // Best-effort — never surface errors to the user
  }
}
