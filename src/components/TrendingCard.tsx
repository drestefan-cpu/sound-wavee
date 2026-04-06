import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmojiReactions from "@/components/EmojiReactions";
import type { TrendingTrack } from "@/lib/trending";

const getPlaceholderColor = (position: number) => {
  const colors = ['#FF2D78', '#1a2535', '#0F1520'];
  return colors[(position - 1) % 3];
};

const TrendingCard = ({ track, onSave, isSaved }: { track: TrendingTrack; onSave?: (track: TrendingTrack) => void; isSaved?: boolean }) => {
  const { user } = useAuth();
  const [localSaved, setLocalSaved] = useState(isSaved ?? false);
  const [bouncing, setBouncing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const toggleSave = async () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);

    const newSaved = !localSaved;
    setLocalSaved(newSaved);

    if (!user) {
      // Local-only for logged-out users
      onSave?.(track);
      return;
    }

    if (newSaved) {
      try {
        // Upsert track into tracks table first
        const { data: trackData, error: trackError } = await supabase
          .from("tracks")
          .upsert({
            spotify_track_id: track.spotifyTrackId,
            title: track.title,
            artist: track.artist,
            album_art_url: track.albumArtUrl,
          }, { onConflict: "spotify_track_id" })
          .select("id")
          .single();

        if (trackError || !trackData) {
          console.error("Track upsert error:", trackError);
          setLocalSaved(false);
          toast.error("couldn't save — try again");
          return;
        }

        const { error } = await supabase.from("saved_tracks").insert({
          user_id: user.id,
          track_id: trackData.id,
          source_context: "trending",
        });
        if (error) {
          console.error("Save find error:", error);
          setLocalSaved(false);
          toast.error("couldn't save — try again");
        }
      } catch {
        setLocalSaved(false);
        toast.error("couldn't save — try again");
      }
    } else {
      // Remove: find track by spotify_track_id then delete saved_track
      const { data: trackData } = await supabase
        .from("tracks")
        .select("id")
        .eq("spotify_track_id", track.spotifyTrackId)
        .maybeSingle();
      if (trackData) {
        const { error } = await supabase.from("saved_tracks").delete().eq("user_id", user.id).eq("track_id", trackData.id);
        if (error) {
          console.error("Remove find error:", error);
          setLocalSaved(true);
          toast.error("couldn't remove — try again");
        }
      }
    }

    onSave?.(track);
  };

  const spotifyUrl = `https://open.spotify.com/track/${track.spotifyTrackId}`;

  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-all duration-150">
      <div className="flex gap-3">
        {track.albumArtUrl && !imgFailed ? (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-md hover:opacity-80 transition-opacity duration-150"
          >
            <img
              src={track.albumArtUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          </a>
        ) : (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: getPlaceholderColor(track.position) }}
          >
            <span className="font-display text-lg text-white">{track.position}</span>
          </a>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-foreground hover:text-primary transition-colors duration-150 flex items-center gap-1"
          >
            <span className="truncate">{track.title}</span>
            <span className="text-muted-foreground text-xs flex-shrink-0">↗</span>
          </a>
          <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
        </div>
        <button
          onClick={toggleSave}
          className={`self-center transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
        >
          <Heart className={`h-7 w-7 ${localSaved ? "fill-primary text-primary" : "text-muted-dim hover:text-primary"}`} />
        </button>
      </div>
      <EmojiReactions likeId={`trending-${track.position}`} localOnly />
    </div>
  );
};

export default TrendingCard;
