import { useState } from "react";
import { Bookmark } from "lucide-react";
import EmojiReactions from "@/components/EmojiReactions";
import type { TrendingTrack } from "@/lib/trending";

const TrendingCard = ({ track, onSave, isSaved }: { track: TrendingTrack; onSave?: (track: TrendingTrack) => void; isSaved?: boolean }) => {
  const [localSaved, setLocalSaved] = useState(isSaved ?? false);
  const [bouncing, setBouncing] = useState(false);

  const toggleSave = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 300);
    setLocalSaved(!localSaved);
    onSave?.(track);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-150">
      <div className="flex gap-3">
        <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-md bg-primary/20">
          <span className="font-display text-lg text-primary">{track.position}</span>
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={track.songlink}
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
          className={`self-center text-muted-dim hover:text-primary transition-all duration-150 ${bouncing ? "scale-125" : "scale-100"}`}
        >
          <Bookmark className={`h-4 w-4 ${localSaved ? "fill-primary text-primary" : ""}`} />
        </button>
      </div>
      <EmojiReactions likeId={`trending-${track.position}`} localOnly />
    </div>
  );
};

export default TrendingCard;
