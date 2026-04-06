import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import EmojiReactions from "@/components/EmojiReactions";
import type { TrendingTrack } from "@/lib/trending";

const positionPlaceholderColors: Record<number, string> = {};
[1,4,7,10,13].forEach(p => positionPlaceholderColors[p] = "bg-primary");
[2,5,8,11,14].forEach(p => positionPlaceholderColors[p] = "bg-[#1a2535]");
[3,6,9,12,15].forEach(p => positionPlaceholderColors[p] = "bg-[#0F1520]");

const TrendingCard = ({ track, onSave, isSaved }: { track: TrendingTrack & { album_art_url?: string | null }; onSave?: (track: TrendingTrack) => void; isSaved?: boolean }) => {
  const [localSaved, setLocalSaved] = useState(isSaved ?? false);
  const [bouncing, setBouncing] = useState(false);

  const toggleSave = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    setLocalSaved(!localSaved);
    onSave?.(track);
  };

  const artUrl = (track as any).album_art_url || track.albumArtUrl;

  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-all duration-150">
      <div className="flex gap-3">
        {artUrl ? (
          <a
            href={track.songlink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-md hover:opacity-80 transition-opacity duration-150"
          >
            <img src={artUrl} alt="" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className={`flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-md ${positionPlaceholderColors[track.position] || "bg-primary/20"}`}>
            <span className="font-display text-lg text-primary-foreground">{track.position}</span>
          </div>
        )}
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
