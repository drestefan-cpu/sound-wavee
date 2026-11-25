import { useState } from "react";
import { Heart, Play, Send } from "lucide-react";
import { getTrackUrl, isYouTubeSentinel } from "@/lib/trackLinks";
import { resolveTrackLinks } from "@/lib/resolveLinks";
import { openUrl } from "@/lib/openUrl";
import { usePlatform } from "@/contexts/PlatformContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { useAuth } from "@/contexts/AuthContext";
import EmojiReactions from "@/components/EmojiReactions";
import TrackDetailModal from "@/components/TrackDetailModal";

export interface UnifiedTrackData {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  albumArtUrl?: string | null;
  spotifyTrackId?: string;
  appleMusicId?: string | null;
  spotifyLinkId?: string | null;
  tidalTrackId?: string | null;
  amazonMusicId?: string | null;
  /** 6-character share code → short links like plai.delaneyprojects.xyz/s/abc123 */
  shortId?: string | null;
  likeId?: string;
  localOnly?: boolean;
  initialReactions?: { emoji: string; count: number }[];
  trackDbId?: string;
}

interface UnifiedTrackCardProps {
  track: UnifiedTrackData;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: () => void;
  onHide?: () => void;
  hideReactions?: boolean;
  compact?: boolean;
  header?: React.ReactNode;
  subtitle?: React.ReactNode;
  placeholderColor?: string;
  placeholderText?: string;
  sourceUserId?: string;
  sourceContext?: string;
  children?: React.ReactNode;
  sharerUsername?: string;
  /** Chart / trending position, shown as a small tag on the artwork */
  rank?: number;
}

const RankTag = ({ rank }: { rank: number }) => (
  <span
    aria-label={`number ${rank}`}
    className={`absolute left-1 top-1 min-w-[18px] rounded-md bg-background/85 px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums backdrop-blur-sm ${
      rank <= 3 ? "text-primary" : "text-foreground/75"
    }`}
  >
    {rank}
  </span>
);

const UnifiedTrackCard = ({
  track,
  isSaved: isSavedProp,
  onToggleSave,
  onShare,
  onHide,
  hideReactions = false,
  compact = false,
  header,
  subtitle,
  placeholderColor,
  placeholderText,
  sourceUserId,
  sourceContext,
  children,
  sharerUsername,
  rank,
}: UnifiedTrackCardProps) => {
  const { preferredPlatform } = usePlatform();
  const { isSaved: isGloballySaved, toggleSave } = useSavedTracks();
  const { user } = useAuth();
  const [bouncing, setBouncing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [artError, setArtError] = useState(false);

  const trackDbId = track.trackDbId || track.id;
  const saved = isSavedProp !== undefined ? isSavedProp : isGloballySaved(trackDbId);
  const trackUrl = getTrackUrl(preferredPlatform, track.spotifyTrackId, track.title, track.artist, track.appleMusicId, track.spotifyLinkId, track.tidalTrackId, track.amazonMusicId);
  const isCurrentlyPlaying = false;
  const isOwnTrack = !!sourceUserId && sourceUserId === user?.id;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    if (onToggleSave) {
      onToggleSave();
    } else {
      toggleSave(trackDbId, sourceUserId, sourceContext);
    }
  };

  // Opens the song in the user's preferred app: the exact track when its ID is known
  // (including Tidal/Apple songs matched to Spotify by ISRC), otherwise a search.
  // Uses the same link as the arrow button so it can never open a broken Spotify address.
  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openUrl(trackUrl);
    // Search was the fallback — look up this song's exact links so the next tap opens it directly
    if (trackUrl.includes("/search") && track.trackDbId) {
      resolveTrackLinks([track.trackDbId], { keepalive: true });
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.();
  };

  const PlayIcon = () => (
    <Play className={compact ? "h-3 w-3 fill-current" : "h-3.5 w-3.5 fill-current"} style={{ color: "hsl(var(--muted-foreground))" }} />
  );

  if (compact) {
    return (
      <>
        <div
          className="rounded-xl border border-border bg-card px-3 py-3 transition-all duration-150 cursor-pointer"
          onClick={() => setShowDetail(true)}
        >
          <div className="flex items-center gap-3">
            <div
              className="relative flex-shrink-0 overflow-hidden rounded-lg bg-card border border-border"
              style={{ width: 56, height: 56 }}
            >
              {track.albumArtUrl && !artError ? (
                <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" onError={() => setArtError(true)} />
              ) : placeholderColor ? (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: placeholderColor }}
                >
                  <span className="font-display text-sm text-white">{placeholderText}</span>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">♪</div>
              )}
              {rank ? <RankTag rank={rank} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground text-sm">{track.title}</p>
              <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
              {subtitle}
            </div>
            <div className="flex flex-col items-center gap-0 flex-shrink-0">
              {/* Your own songs are already in your collection — no save button (spacer keeps play aligned) */}
              {isOwnTrack ? (
                <div className="w-[44px] h-[30px]" aria-hidden="true" />
              ) : (
              <button
                onClick={handleSave}
                aria-label={saved ? "saved" : "save"}
                className={`flex items-center justify-center w-[44px] h-[30px] transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
              >
                <Heart
                  className={`h-[22px] w-[22px] ${saved ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
                  strokeWidth={saved ? 0 : 1.5}
                  style={{ color: saved ? undefined : "hsl(var(--muted-foreground))" }}
                />
              </button>
              )}
              <button
                onClick={handlePlay}
                className="flex items-center justify-center w-[44px] h-[30px] hover:opacity-80"
              >
                <div
                  className="h-[22px] w-[22px] rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "hsl(var(--secondary))" }}
                >
                  <PlayIcon />
                </div>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center w-[44px] h-[30px] hover:opacity-80"
              >
                <div
                  className="h-[22px] w-[22px] rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "hsl(var(--secondary))" }}
                >
                  <Send className="h-3 w-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              </button>
            </div>
          </div>
        </div>
        {children}
        {showDetail && (
          <TrackDetailModal
            track={track}
            spotifyUrl={trackUrl}
            isSaved={saved}
            onToggleSave={() => {
              if (onToggleSave) onToggleSave();
              else toggleSave(trackDbId, sourceUserId, sourceContext);
            }}
            onClose={() => setShowDetail(false)}
            onHide={onHide}
            isOwnTrack={isOwnTrack}
            sharerUsername={sharerUsername}
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
        {header}
        <div className="flex gap-3 items-center">
          <div
            className="relative flex-shrink-0 overflow-hidden rounded-lg bg-card border border-border"
            style={{ width: 72, height: 72 }}
          >
            {track.albumArtUrl && !artError ? (
              <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" onError={() => setArtError(true)} />
            ) : placeholderColor ? (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundColor: placeholderColor }}
              >
                <span className="font-display text-lg text-white">{placeholderText}</span>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">♪</div>
            )}
              {rank ? <RankTag rank={rank} /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-sm">{track.title}</p>
            <p className="truncate text-muted-foreground text-xs">{track.artist}</p>
            {track.album && (
              <p className="truncate text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {track.album}
              </p>
            )}
            {subtitle}
          </div>
          {/* Your own songs are already in your collection — no save button */}
          {!isOwnTrack && (
          <button
            onClick={handleSave}
            aria-label={saved ? "saved" : "save"}
            className={`flex-shrink-0 transition-all duration-200 ${bouncing ? "scale-[1.3]" : "scale-100"}`}
          >
            <Heart
              className={`h-9 w-9 ${saved ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
              strokeWidth={saved ? 0 : 1.5}
              style={{ color: saved ? undefined : "hsl(var(--muted-foreground))" }}
            />
          </button>
          )}
        </div>
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
          <div className="w-px self-stretch mx-1.5 flex-shrink-0" style={{ backgroundColor: "hsl(var(--secondary))" }} />
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePlay}
              className="h-[30px] w-[30px] rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style={{ backgroundColor: "hsl(var(--secondary))" }}
            >
              <PlayIcon />
            </button>
            {onShare && (
              <button
                onClick={handleShare}
                className="h-[30px] w-[30px] rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ backgroundColor: "hsl(var(--secondary))" }}
              >
                <Send className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
              </button>
            )}
          </div>
        </div>
      </div>
      {showDetail && (
        <TrackDetailModal
          track={track}
          spotifyUrl={trackUrl}
          isSaved={saved}
          onToggleSave={() => {
            if (onToggleSave) onToggleSave();
            else toggleSave(trackDbId, sourceUserId, sourceContext);
          }}
          onClose={() => setShowDetail(false)}
          onHide={onHide}
          isOwnTrack={isOwnTrack}
        />
      )}
    </>
  );
};

export default UnifiedTrackCard;
