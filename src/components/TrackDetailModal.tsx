import { useState } from "react";
import { Heart, ExternalLink, Send, X } from "lucide-react";
import type { UnifiedTrackData } from "./UnifiedTrackCard";
import RecommendModal from "./RecommendModal";

interface TrackDetailModalProps {
  track: UnifiedTrackData;
  spotifyUrl: string;
  isSaved: boolean;
  onToggleSave?: () => void;
  onClose: () => void;
  hidePlay?: boolean;
}

const openUrl = (url: string) => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (isStandalone) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

const TrackDetailModal = ({
  track,
  spotifyUrl,
  isSaved,
  onToggleSave,
  onClose,
  hidePlay = false,
}: TrackDetailModalProps) => {
  const [showRecommend, setShowRecommend] = useState(false);

  const handleOpenSpotify = () => {
    if (track.spotifyTrackId) {
      openUrl(`https://open.spotify.com/track/${track.spotifyTrackId}`);
    } else {
      openUrl(spotifyUrl);
    }
  };

  // If recommend modal is open, show it instead of the detail modal
  if (showRecommend) {
    return (
      <RecommendModal
        trackId={track.trackDbId || track.id}
        trackTitle={track.title}
        onClose={() => setShowRecommend(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="w-full aspect-square rounded-xl overflow-hidden bg-secondary mb-4">
          {track.albumArtUrl ? (
            <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">🎵</div>
          )}
        </div>

        <h3 className="text-lg font-medium text-foreground truncate">{track.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
        {track.album && (
          <p className="text-xs truncate mt-0.5" style={{ color: "#2a3a4a" }}>
            {track.album}
          </p>
        )}

        <div className="flex items-center justify-center gap-8 mt-6">
          <button
            onClick={onToggleSave}
            className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
          >
            <Heart
              className={`h-8 w-8 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`}
              strokeWidth={isSaved ? 0 : 1.5}
            />
            <span className="text-[10px] text-muted-foreground">{isSaved ? "saved" : "save"}</span>
          </button>

          {!hidePlay && (
            <button
              onClick={handleOpenSpotify}
              className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1a2535" }}
              >
                <ExternalLink className="h-4 w-4" style={{ color: "#4a6a8a" }} />
              </div>
              <span className="text-[10px] text-muted-foreground">spotify</span>
            </button>
          )}

          <button
            onClick={() => setShowRecommend(true)}
            className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#1a2535" }}
            >
              <Send className="h-4 w-4" style={{ color: "#4a6a8a" }} />
            </div>
            <span className="text-[10px] text-muted-foreground">recommend</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackDetailModal;
