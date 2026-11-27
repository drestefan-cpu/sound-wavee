import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";

/** "song of the week" on a profile: the one song they've pinned (shown for 7 days) */

interface Props {
  trackId?: string | null;
  setAt?: string | null;
  note?: string | null;
  isOwn: boolean;
  sharerUsername?: string;
}

type Track = {
  id: string;
  title: string;
  artist: string;
  album_art_url: string | null;
  short_id: string | null;
  spotify_track_id: string | null;
  spotify_link_id: string | null;
  apple_music_id: string | null;
  tidal_track_id: string | null;
  amazon_music_id: string | null;
};

const SongOfWeek = ({ trackId, setAt, note, isOwn, sharerUsername }: Props) => {
  const current = !!trackId && !!setAt && Date.now() - new Date(setAt).getTime() < 7 * 86400_000;
  const [track, setTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (!current || !trackId) {
      setTrack(null);
      return;
    }
    supabase
      .from("tracks")
      .select("id, title, artist, album_art_url, short_id, spotify_track_id, spotify_link_id, apple_music_id, tidal_track_id, amazon_music_id")
      .eq("id", trackId)
      .maybeSingle()
      .then(({ data }) => setTrack((data as unknown as Track) || null));
  }, [current, trackId]);

  if (!current) {
    if (!isOwn) return null;
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Pin className="h-3 w-3" /> pin a song of the week: open any song → "make this my song of the week"
      </p>
    );
  }
  if (!track) return null;

  return (
    <section aria-label="song of the week" className="w-full">
      <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
        <Pin className="h-3 w-3 fill-current" /> song of the week
      </p>
      <UnifiedTrackCard
        compact
        hideReactions
        sharerUsername={sharerUsername}
        track={{
          id: track.id,
          trackDbId: track.id,
          title: track.title,
          artist: track.artist,
          albumArtUrl: track.album_art_url,
          shortId: track.short_id,
          spotifyTrackId: track.spotify_track_id || undefined,
          spotifyLinkId: track.spotify_link_id,
          appleMusicId: track.apple_music_id,
          tidalTrackId: track.tidal_track_id,
          amazonMusicId: track.amazon_music_id,
        }}
      />
      {note && <p className="mt-1 text-center text-[11px] italic text-muted-foreground">“{note}”</p>}
    </section>
  );
};

export default SongOfWeek;
