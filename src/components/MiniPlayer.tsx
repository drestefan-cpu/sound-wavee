import { Pause, Play } from "lucide-react";
import { useSpotifyPlayer } from "@/contexts/SpotifyPlayerContext";

const MiniPlayer = () => {
  const { currentTrackId, isPlaying, progress, duration, trackTitle, trackArtist, trackArt, togglePlayPause } = useSpotifyPlayer();

  if (!currentTrackId) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40">
      {/* Progress bar */}
      <div className="h-[2px] w-full" style={{ backgroundColor: "#1a2535" }}>
        <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, backgroundColor: "#FF2D78" }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border" style={{ backgroundColor: "#0a0e17" }}>
        {trackArt ? (
          <img src={trackArt} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground" style={{ backgroundColor: "#1a2535" }}>♪</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" style={{ color: "#F0EBE3" }}>{trackTitle}</p>
          <p className="truncate text-[11px]" style={{ color: "#4a6a8a" }}>{trackArtist}</p>
        </div>
        <button onClick={togglePlayPause} className="h-[30px] w-[30px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#1a2535" }}>
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" style={{ color: "#F0EBE3" }} />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" style={{ color: "#F0EBE3" }} />
          )}
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
