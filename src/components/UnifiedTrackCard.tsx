import { useState } from "react";
import { Heart, Play, Send } from "lucide-react";
import { getSpotifyUrl } from "@/lib/songlink";
import EmojiReactions from "@/components/EmojiReactions";
import TrackDetailModal from "@/components/TrackDetailModal";

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
  hideReactions?: boolean;
  compact?: boolean;
  header?: React.ReactNode;
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
    onShare?.();
  };

  const artPx = compact ? 56 : 72;
  const heartSize = compact ? "h-[22px] w-[22px]" : "h-9 w-9";
  const actionCircle = compact ? "h-[22px] w-[22px]" : "h-[30px] w-[30px]";
  const actionIcon = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const titleSize = compact ? "text-sm" : "text-sm";
  const artistSize = compact ? "text-xs" : "text-xs";

  if (compact) {
    return (
      <>
        <div
          className="rounded-xl border border-border bg-card px-3 py-3 transition-all duration-150 cursor-pointer"
          onClick={() => setShowDetail(true)}
        >
          <div className="flex items-center gap-3">
            {/* Artwork */}
            <div
              className="flex-shrink-0 overflow-hidden rounded-lg bg-card border border-border"
              style={{ width: 56, height: 56 }}
            >
              {track.albumArtUrl ? (
                <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">♪</div>
              )}
            </div>

            {/* Track info */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground text-sm">{track.title}</p>
              <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
              {subtitle}
            </div>

            {/* Action column */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleSave}
                className={`transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
              >
                <Heart
                  className={`h-[22px] w-[22px] ${saved ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
                  strokeWidth={saved ? 0 : 1.5}
                  style={{ color: saved ? undefined : "#2a3a4a" }}
                />
              </button>
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-[22px] w-[22px] rounded-full flex items-center justify-center hover:opacity-80"
                style={{ backgroundColor: "#1a2535" }}
              >
                <Play className="h-3 w-3 fill-current" style={{ color: "#4a6a8a" }} />
              </a>
              {onShare && (
                <button
                  onClick={handleShare}
                  className="h-[22px] w-[22px] rounded-full flex items-center justify-center hover:opacity-80"
                  style={{ backgroundColor: "#1a2535" }}
                >
                  <Send className="h-3 w-3" style={{ color: "#4a6a8a" }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {showDetail && (
          <TrackDetailModal
            track={track}
            spotifyUrl={spotifyUrl}
            isSaved={saved}
            onToggleSave={() => { setSaved(!saved); onToggleSave?.(); }}
            onShare={onShare}
            onClose={() => setShowDetail(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className="rounded-xl border border-border bg-card p-3 transition-all duration-150 cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        {/* Zone 1 — Header */}
        {header}

        {/* Zone 2 — Body */}
        <div className="flex gap-3 items-start">
          {/* Artwork */}
          <div
            className="flex-shrink-0 overflow-hidden rounded-lg bg-card border border-border"
            style={{ width: artPx, height: artPx }}
          >
            {track.albumArtUrl ? (
              <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                ♪
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className={`truncate font-medium text-foreground ${titleSize}`}>
              {track.title}
            </p>
            <p className={`truncate text-muted-foreground ${artistSize}`}>{track.artist}</p>
            {track.album && (
              <p className="truncate text-[11px]" style={{ color: "#2a3a4a" }}>{track.album}</p>
            )}
            {subtitle}
          </div>

          {/* Heart — primary action */}
          <button
            onClick={handleSave}
            className={`flex-shrink-0 transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
          >
            <Heart
              className={`${heartSize} ${
                saved
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/40 hover:text-primary"
              }`}
              strokeWidth={saved ? 0 : 1.5}
              style={{ color: saved ? undefined : "#2a3a4a" }}
            />
          </button>
        </div>

        {/* Zone 3 — Bottom row */}
        <div className="flex items-center gap-1.5 pt-2">
          <div className="flex-1 min-w-0">
            {!hideReactions && track.likeId && (
              <EmojiReactions
                likeId={track.likeId}
                localOnly={track.localOnly}
                initialReactions={track.initialReactions}
                compact={compact}
              />
            )}
          </div>

          <div className="w-px self-stretch mx-1.5 flex-shrink-0" style={{ backgroundColor: '#1a2535' }} />

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`${actionCircle} rounded-full flex items-center justify-center transition-colors hover:opacity-80`}
              style={{ backgroundColor: "#1a2535" }}
            >
              <Play className={`${actionIcon} fill-current`} style={{ color: "#4a6a8a" }} />
            </a>
            {onShare && (
              <button
                onClick={handleShare}
                className={`${actionCircle} rounded-full flex items-center justify-center transition-colors hover:opacity-80`}
                style={{ backgroundColor: "#1a2535" }}
              >
                <Send className={actionIcon} style={{ color: "#4a6a8a" }} />
              </button>
            )}
          </div>
        </div>
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
