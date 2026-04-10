import { supabase } from "@/integrations/supabase/client";

export async function followArtistForTrack(
  userId: string,
  trackId: string,
  followSource: "saved_track" | "sent_track",
) {
  if (!userId || !trackId) return;

  const { data: track } = await supabase.from("tracks").select("artist").eq("id", trackId).maybeSingle();
  const artistName = track?.artist?.trim();
  if (!artistName) return;

  const { data: existing } = await (supabase
    .from("user_followed_artists" as any)
    .select("id")
    .eq("user_id", userId)
    .ilike("artist_name", artistName)
    .limit(1)
    .maybeSingle() as any);

  if (existing?.id) return;

  const { error } = await (supabase.from("user_followed_artists" as any).insert({
    user_id: userId,
    artist_name: artistName,
    follow_source: followSource,
  }) as any);

  if (error && (error as any).code !== "23505") {
    throw error;
  }
}
