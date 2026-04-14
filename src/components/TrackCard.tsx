import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EmojiReactions from "@/components/EmojiReactions";
import { getSpotifyUrl } from "@/lib/songlink";
import { toast } from "sonner";
import { formatTimestamp } from "@/lib/formatTimestamp";

interface FeedItem {
  id: string;
  liked_at: string;
  user_id: string;
  track_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  tracks: {
    id: string;
    spotify_track_id: string;
    title: string;
    artist: string;
    album: string | null;
    album_art_url: string | null;
    preview_url: string | null;
  };
}


const TrackCard = ({
  item,
  isSaved: externalSaved,
  onToggleSave,
  onRecommend,
}: {
  item: FeedItem;
  isSaved?: boolean;
  onToggleSave?: (trackId: string, sourceUserId: string, sourceContext: string) => void;
  onRecommend?: () => void;
}) => {
  const { user } = useAuth();
  const profile = item.profiles;
  const track = item.tracks;
  const [saved, setSaved] = useState(externalSaved ?? false);
  const [bouncing, setBouncing] = useState(false);

  const toggleSave = async () => {
    if (!user) return;
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);

    const newSaved = !saved;
    setSaved(newSaved);

    if (onToggleSave) {
      onToggleSave(track.id, profile.id, "feed");
      return;
    }

    if (newSaved) {
      const { error } = await supabase.from("saved_tracks").insert({
        user_id: user.id,
        track_id: track.id,
        source_user_id: profile.id,
        source_context: "feed",
      } as any);
      if (error) {
        console.error("Save find error:", error);
        setSaved(false);
        toast.error("couldn't save — try again");
      }
    } else {
      const { error } = await supabase.from("saved_tracks").delete().eq("user_id", user.id).eq("track_id", track.id);
      if (error) {
        console.error("Remove find error:", error);
        setSaved(true);
        toast.error("couldn't remove — try again");
      }
    }
  };

  const spotifyUrl = getSpotifyUrl(track?.spotify_track_id, track?.title, track?.artist);

  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-all duration-150 animate-slide-in">
      <div className="mb-2 flex items-center gap-3">
        <Link to={`/profile/${profile?.username || profile?.id}`}>
          <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/20">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {(profile?.display_name || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/profile/${profile?.username || profile?.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150"
          >
            {profile?.display_name || "User"}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatTimestamp(item.liked_at)}</span>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Spotify
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRecommend && (
            <button onClick={onRecommend} className="text-muted-dim hover:text-primary transition-colors">
              <Share2 className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={toggleSave}
            className={`transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
          >
            <Heart className={`h-7 w-7 ${saved ? "fill-primary text-primary" : "text-muted-dim hover:text-primary"}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {track?.album_art_url && (
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={track.album_art_url}
              alt={track.album || ""}
              className="h-[52px] w-[52px] rounded-md object-cover hover:opacity-80 transition-opacity duration-150"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-foreground hover:text-primary transition-colors duration-150 flex items-center gap-1"
          >
            <span className="truncate">{track?.title}</span>
            <span className="text-muted-foreground text-xs flex-shrink-0">↗</span>
          </a>
          <p className="truncate text-sm text-muted-foreground">{track?.artist}</p>
          {track?.album && (
            <p className="truncate text-xs text-muted-dim">{track.album}</p>
          )}
        </div>
      </div>

      <EmojiReactions likeId={item.id} />
    </div>
  );
};

export default TrackCard;
