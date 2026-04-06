import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EmojiReactions from "@/components/EmojiReactions";
import { getSonglinkUrl } from "@/lib/songlink";

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

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const TrackCard = ({ item }: { item: FeedItem }) => {
  const { user } = useAuth();
  const profile = item.profiles;
  const track = item.tracks;
  const [saved, setSaved] = useState(false);

  const toggleSave = async () => {
    if (!user) return;
    setSaved((prev) => !prev);
    if (saved) {
      await supabase.from("saved_tracks").delete().eq("user_id", user.id).eq("track_id", track.id);
    } else {
      await supabase.from("saved_tracks").insert({ user_id: user.id, track_id: track.id });
    }
  };

  const songlinkUrl = getSonglinkUrl(track?.spotify_track_id, track?.title, track?.artist);

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-150 animate-slide-in">
      {/* User header */}
      <div className="mb-3 flex items-center gap-3">
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
            <span className="text-xs text-muted-foreground">{timeAgo(item.liked_at)}</span>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Spotify
            </span>
          </div>
        </div>
        <button
          onClick={toggleSave}
          className="text-muted-foreground hover:text-primary transition-colors duration-150"
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`} />
        </button>
      </div>

      {/* Track info */}
      <div className="flex gap-3">
        {track?.album_art_url && (
          <a href={songlinkUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={track.album_art_url}
              alt={track.album || ""}
              className="h-[52px] w-[52px] rounded-md object-cover hover:opacity-80 transition-opacity duration-150"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={songlinkUrl}
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

      {/* Emoji reactions */}
      <EmojiReactions likeId={item.id} />
    </div>
  );
};

export default TrackCard;
