import { useState } from "react";
import { Bookmark } from "lucide-react";
import EmojiReactions from "@/components/EmojiReactions";
import { getSpotifyUrl } from "@/lib/songlink";
import type { DemoFeedItem } from "@/lib/demoData";

const DemoCard = ({ item, onSave, isSaved }: { item: DemoFeedItem; onSave?: (item: DemoFeedItem) => void; isSaved?: boolean }) => {
  const [localSaved, setLocalSaved] = useState(isSaved ?? false);
  const [bouncing, setBouncing] = useState(false);
  const spotifyUrl = getSpotifyUrl(item.track.spotify_track_id, item.track.title, item.track.artist);

  const toggleSave = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 300);
    setLocalSaved(!localSaved);
    onSave?.(item);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-150 relative">
      {/* Preview pill */}
      <span className="absolute top-3 right-12 rounded-full bg-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
        preview
      </span>

      {/* Save button */}
      <button
        onClick={toggleSave}
        className={`absolute top-3 right-3 text-muted-dim hover:text-primary transition-all duration-150 ${bouncing ? "scale-125" : "scale-100"}`}
      >
        <Bookmark className={`h-4 w-4 ${localSaved ? "fill-primary text-primary" : ""}`} />
      </button>

      {/* User header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/20">
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
            {item.user.display_name[0].toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{item.user.display_name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{item.time_ago}</span>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Spotify
            </span>
          </div>
        </div>
      </div>

      {/* Track */}
      <div className="min-w-0">
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary transition-colors duration-150 flex items-center gap-1"
        >
          <span className="truncate">{item.track.title}</span>
          <span className="text-muted-foreground text-xs flex-shrink-0">↗</span>
        </a>
        <p className="truncate text-sm text-muted-foreground">{item.track.artist}</p>
      </div>

      <EmojiReactions likeId={item.id} localOnly initialReactions={item.reactions} />
    </div>
  );
};

export default DemoCard;
