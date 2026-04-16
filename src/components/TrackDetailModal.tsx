import { useState, useEffect } from "react";
import { Heart, ExternalLink, Send, X } from "lucide-react";
import type { UnifiedTrackData } from "./UnifiedTrackCard";
import RecommendModal from "./RecommendModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import { isYouTubeSentinel, extractYouTubeVideoId } from "@/lib/trackLinks";
import { toast } from "sonner";

interface TrackDetailModalProps {
  track: UnifiedTrackData;
  spotifyUrl: string;
  isSaved: boolean;
  onToggleSave?: () => void;
  onClose: () => void;
  hidePlay?: boolean;
  onHide?: () => void;
  isOwnTrack?: boolean;
}

// Log track detail view silently
const logTrackView = async (userId: string | null, trackId: string, sourceContext: string) => {
  if (!userId || !trackId) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await (supabase.from("track_views" as any).insert({
      user_id: userId,
      track_id: trackId,
      source_context: sourceContext,
    }) as any);
  } catch {}
};

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
  onHide,
  isOwnTrack,
}: TrackDetailModalProps) => {
  const [showRecommend, setShowRecommend] = useState(false);
  const [artError, setArtError] = useState(false);
  const { user } = useAuth();
  const { preferredPlatform } = usePlatform();

  const canHide = !!user && !!track.likeId && !!track.trackDbId && isOwnTrack !== false;

  const handleHide = async () => {
    if (!user || !track.trackDbId) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: exclusion } = await (supabase
        .from("collection_exclusions" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("track_id", track.trackDbId)
        .maybeSingle() as any);

      if (exclusion) {
        await (supabase
          .from("hidden_tracks" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", track.trackDbId) as any);
        toast("song is already removed from your collection");
        onClose();
        onHide?.();
        return;
      }

      await (supabase.from("hidden_tracks" as any).insert({
        user_id: user.id,
        track_id: track.trackDbId,
      }) as any);
      toast("song hidden from your collection — find it in your hidden tab");
      onClose();
      onHide?.();
    } catch {
      toast.error("couldn't hide song — try again");
    }
  };

  useEffect(() => {
    if (track?.trackDbId && user?.id) {
      logTrackView(user.id, track.trackDbId, "detail_modal");
    }
  }, []);

  const platformLabel: Record<string, string> = {
    spotify: "spotify",
    apple_music: "apple music",
    youtube_music: "youtube",
    tidal: "tidal",
  };

  const ytVideoId = extractYouTubeVideoId(track.spotifyTrackId);
  const showYouTubeButton = !!ytVideoId && preferredPlatform !== "youtube_music";

  const getPlatformUrl = () => {
    const q = encodeURIComponent(`${track.title} ${track.artist}`);
    const realSpotifyId = track.spotifyTrackId && !isYouTubeSentinel(track.spotifyTrackId)
      ? track.spotifyTrackId
      : undefined;
    switch (preferredPlatform) {
      case "apple_music":
        return `https://music.apple.com/search?term=${q}`;
      case "youtube_music":
        return ytVideoId
          ? `https://music.youtube.com/watch?v=${ytVideoId}`
          : `https://music.youtube.com/search?q=${q}`;
      case "tidal":
        return `https://listen.tidal.com/search?q=${q}`;
      default:
        return realSpotifyId
          ? `https://open.spotify.com/track/${realSpotifyId}`
          : `https://open.spotify.com/search/${q}`;
    }
  };

  const handleOpenPlatform = () => openUrl(getPlatformUrl());

  return (
    <>
    {showRecommend && (
      <RecommendModal
        trackId={track.trackDbId || track.id}
        trackTitle={track.title}
        onClose={() => setShowRecommend(false)}
      />
    )}
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
          {track.albumArtUrl && !artError ? (
            <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" onError={() => setArtError(true)} />
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
          {isOwnTrack ? (
            <div className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed" title="you already have this">
              <Heart className="h-8 w-8 fill-primary text-primary" strokeWidth={0} />
              <span className="text-[10px] text-muted-foreground">yours</span>
            </div>
          ) : (
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
          )}

          {!hidePlay && (
            <button
              onClick={handleOpenPlatform}
              className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1a2535" }}
              >
                <ExternalLink className="h-4 w-4" style={{ color: "#4a6a8a" }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{platformLabel[preferredPlatform] ?? "spotify"}</span>
            </button>
          )}

          {showYouTubeButton && (
            <button
              onClick={() => openUrl(`https://www.youtube.com/watch?v=${ytVideoId}`)}
              className="flex flex-col items-center gap-1 transition-all duration-200 hover:scale-105"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1a2535" }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" style={{ color: "#4a6a8a" }}>
                  <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                </svg>
              </div>
              <span className="text-[10px] text-muted-foreground">youtube</span>
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

        {canHide && (
          <button
            onClick={handleHide}
            className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            hide from my collection
          </button>
        )}
      </div>
    </div>
    </>
  );
};

export default TrackDetailModal;
