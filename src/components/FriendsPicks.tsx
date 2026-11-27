import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import Artwork from "@/components/Artwork";
import TrackDetailModal from "@/components/TrackDetailModal";
import type { UnifiedTrackData } from "@/components/UnifiedTrackCard";

/** Top of the friends feed: each friend's song of the week, as a row of covers */

type Pick = {
  user_id: string;
  username: string;
  display_name: string | null;
  note: string | null;
  track_id: string;
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

const FriendsPicks = () => {
  const { user } = useAuth();
  const { isSaved, toggleSave } = useSavedTracks();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [open, setOpen] = useState<Pick | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("friends_picks").then(({ data }: { data: Pick[] | null }) => setPicks(data || []));
  }, [user]);

  if (picks.length === 0) return null;

  const asTrack = (p: Pick): UnifiedTrackData => ({
    id: p.track_id,
    trackDbId: p.track_id,
    title: p.title,
    artist: p.artist,
    albumArtUrl: p.album_art_url,
    shortId: p.short_id,
    spotifyTrackId: p.spotify_track_id || undefined,
    spotifyLinkId: p.spotify_link_id,
    appleMusicId: p.apple_music_id,
    tidalTrackId: p.tidal_track_id,
    amazonMusicId: p.amazon_music_id,
  });

  return (
    <section aria-label="friends' songs of the week" className="mb-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
        <Pin className="h-3 w-3 fill-current" /> friends' songs of the week
      </h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {picks.map((p) => (
          <button
            key={p.user_id}
            onClick={() => setOpen(p)}
            className="w-28 shrink-0 text-left"
            style={{ touchAction: "manipulation" }}
          >
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-secondary">
              <Artwork
                src={p.album_art_url}
                fallback={<div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">♪</div>}
              />
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-foreground">{p.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{p.display_name || `@${p.username}`}</p>
          </button>
        ))}
      </div>
      {open && (
        <TrackDetailModal
          track={asTrack(open)}
          spotifyUrl={open.spotify_track_id ? `https://open.spotify.com/track/${open.spotify_track_id}` : ""}
          isSaved={isSaved(open.track_id)}
          onToggleSave={() => toggleSave(open.track_id, open.user_id, "pick")}
          onClose={() => setOpen(null)}
          sharerUsername={undefined}
        />
      )}
    </section>
  );
};

export default FriendsPicks;
