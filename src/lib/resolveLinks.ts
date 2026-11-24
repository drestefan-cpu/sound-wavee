import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export interface ResolvedLinks {
  id: string;
  spotify_track_id: string | null;
  spotify_link_id: string | null;
  apple_music_id: string | null;
  tidal_track_id: string | null;
}

/**
 * Asks the server to find a song's missing Spotify / Apple Music IDs (by ISRC) and returns them.
 * Used when the app meets a song whose cross-platform links aren't known yet. Never throws.
 */
export async function resolveTrackLinks(trackIds: string[], opts: { keepalive?: boolean } = {}): Promise<ResolvedLinks[]> {
  const ids = [...new Set(trackIds.filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-track-links`, {
      method: "POST",
      keepalive: opts.keepalive,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ track_ids: ids }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks || []) as ResolvedLinks[];
  } catch {
    return [];
  }
}
