import { useState } from "react";
import { Heart, Send, ExternalLink } from "lucide-react";
import { getSpotifyUrl } from "@/lib/songlink";
import EmojiReactions from "@/components/EmojiReactions";
import TrackDetailModal from "@/components/TrackDetailModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface UnifiedTrackData {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  albumArtUrl?: string | null;
  spotifyTrackId?: string;
  likeId?: string;
  localOnly?: boolean;
  initialReactions?: { emoji: string; count: number }[];
}

interface UnifiedTrackCardProps {
  track: UnifiedTrackData;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: () => void;
  /** Hide emoji reactions row */
  hideReactions?: boolean;
  /** Compact sizing for grids */
  compact?: boolean;
  /** Extra content above the card (e.g. user header) */
  header?: React.ReactNode;
  /** Extra info below artist */
  subtitle?: React.ReactNode;
}

const UnifiedTrackCard = ({
  track,
  isSaved = false,
  onToggleSave,
  onShare,
  hideReactions = false,
  compact = false,
  header,
  subtitle,
}: UnifiedTrackCardProps) => {
  const [saved, setSaved] = useState(isSaved);
  const [bouncing, setBouncing] = useState(false);
  const [shareBounce, setShareBounce] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const spotifyUrl = getSpotifyUrl(track.spotifyTrackId, track.title, track.artist);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    setSaved(!saved);
    onToggleSave?.();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareBounce(true);
    setTimeout(() => setShareBounce(false), 200);
    onShare?.();
  };

  const artSize = compact ? "h-11 w-11" : "h-[52px] w-[52px]";

  return (
    <>
      <div
        className="rounded-xl border border-border bg-card p-3 transition-all duration-150 animate-slide-in cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        {header}

        <div className="flex gap-3 items-center">
          {/* Album art */}
          <div
            className={`${artSize} flex-shrink-0 overflow-hidden rounded-md bg-card border border-border`}
          >
            {track.albumArtUrl ? (
              <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                🎵
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-sm">
              {track.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
            {track.album && !compact && (
              <p className="truncate text-[10px] text-muted-dim">{track.album}</p>
            )}
            {subtitle}
          </div>

          {/* Action stack */}
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSave}
                    className={`transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        saved
                          ? "fill-primary text-primary"
                          : "text-muted-dim hover:text-primary"
                      }`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{saved ? "unsave" : "save"}</p>
                </TooltipContent>
              </Tooltip>

              {onShare && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleShare}
                      className={`transition-all duration-200 ${shareBounce ? "scale-105" : "scale-100"}`}
                    >
                      <Send className="h-4 w-4 text-muted-dim hover:text-primary transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>share</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-dim hover:text-[#1DB954] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>play on Spotify</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {!hideReactions && track.likeId && (
          <EmojiReactions
            likeId={track.likeId}
            localOnly={track.localOnly}
            initialReactions={track.initialReactions}
          />
        )}
      </div>

      {showDetail && (
        <TrackDetailModal
          track={track}
          spotifyUrl={spotifyUrl}
          isSaved={saved}
          onToggleSave={() => {
            setSaved(!saved);
            onToggleSave?.();
          }}
          onShare={onShare}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
};

export default UnifiedTrackCard;
