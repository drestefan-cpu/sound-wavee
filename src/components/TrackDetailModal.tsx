import { Heart, Send, ExternalLink, X } from "lucide-react";
import type { UnifiedTrackData } from "./UnifiedTrackCard";

interface TrackDetailModalProps {
  track: UnifiedTrackData;
  spotifyUrl: string;
  isSaved: boolean;
  onToggleSave?: () => void;
  onShare?: () => void;
  onClose: () => void;
}

const TrackDetailModal = ({
  track,
  spotifyUrl,
  isSaved,
  onToggleSave,
  onShare,
  onClose,
}: TrackDetailModalProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
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

        {/* Large album art */}
        <div className="w-full aspect-square rounded-xl overflow-hidden bg-secondary mb-4">
          {track.albumArtUrl ? (
            <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">
              🎵
            </div>
          )}
        </div>

        {/* Info */}
        <h3 className="text-lg font-medium text-foreground truncate">{track.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
        {track.album && (
          <p className="text-xs text-muted-dim truncate mt-0.5">{track.album}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            onClick={onToggleSave}
            className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
          >
            <Heart
              className={`h-7 w-7 ${
                isSaved ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"
              }`}
            />
            <span className="text-[10px] text-muted-foreground">{isSaved ? "saved" : "save"}</span>
          </button>

          {onShare && (
            <button
              onClick={onShare}
              className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
            >
              <Send className="h-6 w-6 text-muted-foreground hover:text-primary" />
              <span className="text-[10px] text-muted-foreground">share</span>
            </button>
          )}

          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
          >
            <ExternalLink className="h-6 w-6 text-muted-foreground hover:text-[#1DB954]" />
            <span className="text-[10px] text-muted-foreground">play</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TrackDetailModal;
