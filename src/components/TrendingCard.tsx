import EmojiReactions from "@/components/EmojiReactions";
import type { TrendingTrack } from "@/lib/trending";

const TrendingCard = ({ track }: { track: TrendingTrack }) => (
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
    </div>
    <EmojiReactions likeId={`trending-${track.position}`} localOnly />
  </div>
);

export default TrendingCard;
