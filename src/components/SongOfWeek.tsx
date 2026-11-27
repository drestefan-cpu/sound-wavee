import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import Artwork from "@/components/Artwork";
import TrackDetailModal from "@/components/TrackDetailModal";

/**
 * "song of the week" on a profile: a small pink-outlined pill (cover, label, title · artist).
 * Tapping it opens the song. Shown for 7 days after pinning.
 */

interface Props {
  trackId?: string | null;
  setAt?: string | null;
  note?: string | null;
  isOwn: boolean;
  ownerId?: string;
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

const SongOfWeek = ({ trackId, setAt, note, isOwn, ownerId, sharerUsername }: Props) => {
  const current = !!trackId && !!setAt && Date.now() - new Date(setAt).getTime() < 7 * 86400_000;
  const [track, setTrack] = useState<Track | null>(null);
  const [open, setOpen] = useState(false);
  const { isSaved, toggleSave } = useSavedTracks();

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

  // Your own profile with nothing pinned: a quiet hint
  if (!current) {
    if (!isOwn) return null;
    return (
      <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/70">
        <Pin className="h-2.5 w-2.5" /> open any song to pin your song of the week
      </p>
    );
  }
  if (!track) return <div className="mx-auto h-11 w-56 animate-pulse rounded-full border border-primary/20" />;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setOpen(true)}
        aria-label={`song of the week: ${track.title} by ${track.artist}`}
        className="group flex max-w-full items-center gap-2.5 rounded-full border border-primary/60 bg-primary/[0.06] py-1 pl-1 pr-4 transition-colors hover:border-primary hover:bg-primary/10"
        style={{ touchAction: "manipulation" }}
      >
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-secondary">
          <Artwork
            src={track.album_art_url}
            fallback={<span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">♪</span>}
          />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.14em] text-primary">
            <Pin className="h-2.5 w-2.5 fill-current" /> song of the week
          </span>
          <span className="block truncate text-xs text-foreground">
            {track.title}
            <span className="text-muted-foreground"> · {track.artist}</span>
          </span>
        </span>
      </button>
      {note && <p className="max-w-[16rem] truncate text-[10px] italic text-muted-foreground">“{note}”</p>}

      {open && (
        <TrackDetailModal
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
          spotifyUrl={track.spotify_track_id ? `https://open.spotify.com/track/${track.spotify_track_id}` : ""}
          isSaved={isSaved(track.id)}
          onToggleSave={() => toggleSave(track.id, ownerId, "pick")}
          onClose={() => setOpen(false)}
          sharerUsername={sharerUsername}
        />
      )}
    </div>
  );
};

export default SongOfWeek;
