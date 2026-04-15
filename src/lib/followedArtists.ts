import { supabase } from "@/integrations/supabase/client";

export async function followArtistForTrack(
  userId: string,
  trackId: string,
  followSource: "saved_track" | "sent_track",
) {
  if (!userId || !trackId) return;

  const { data: track } = await supabase.from("tracks").select("artist").eq("id", trackId).maybeSingle();
  const rawArtist = track?.artist?.trim();
  if (!rawArtist) return;

  const artistNames = rawArtist.split(/\s*,\s*/).map((n) => n.trim()).filter(Boolean);

  for (const artistName of artistNames) {
    const { data: existing } = await (supabase
      .from("user_followed_artists" as any)
      .select("id")
      .eq("user_id", userId)
      .ilike("artist_name", artistName)
      .limit(1)
      .maybeSingle() as any);

    if (existing?.id) continue;

    const { error } = await (supabase.from("user_followed_artists" as any).insert({
      user_id: userId,
      artist_name: artistName,
      follow_source: followSource,
    }) as any);

    if (error && (error as any).code !== "23505") {
      throw error;
    }
  }
}
