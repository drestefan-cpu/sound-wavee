import { useState } from "react";
import { Heart } from "lucide-react";
import EmojiReactions from "@/components/EmojiReactions";
import type { TrendingTrack } from "@/lib/trending";

const positionColors = [
  "bg-primary", "bg-primary/90", "bg-primary/80", "bg-primary/70", "bg-primary/60",
  "bg-primary/50", "bg-primary/45", "bg-primary/40", "bg-primary/35", "bg-primary/30",
  "bg-primary/28", "bg-primary/25", "bg-primary/22", "bg-primary/20", "bg-primary/18",
];

const TrendingCard = ({ track, onSave, isSaved }: { track: TrendingTrack; onSave?: (track: TrendingTrack) => void; isSaved?: boolean }) => {
  const [localSaved, setLocalSaved] = useState(isSaved ?? false);
  const [bouncing, setBouncing] = useState(false);

  const toggleSave = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    setLocalSaved(!localSaved);
    onSave?.(track);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-all duration-150">
      <div className="flex gap-3">
        <div className={`flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-md ${positionColors[track.position - 1] || "bg-primary/20"}`}>
          <span className="font-display text-lg text-primary-foreground">{track.position}</span>
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
