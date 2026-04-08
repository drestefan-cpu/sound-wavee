import { useEffect, useState, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { useSpotifyPlayer } from "@/contexts/SpotifyPlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { supabase } from "@/integrations/supabase/client";
import TrackDetailModal from "@/components/TrackDetailModal";

interface NowPlaying {
  trackId: string;
  title: string;
  artist: string;
  artUrl: string;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}

const MiniPlayer = () => {
  const {
    currentTrackId,
    isPlaying: sdkPlaying,
    progress: sdkProgress,
    duration: sdkDuration,
    trackTitle: sdkTitle,
    trackArtist: sdkArtist,
    trackArt: sdkArt,
    togglePlayPause,
  } = useSpotifyPlayer();
  const { user } = useAuth();
  const { isSaved, toggleSave } = useSavedTracks();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [interpolatedProgress, setInterpolatedProgress] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const progressRef = useRef<ReturnType<typeof setInterval>>();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("spotify_access_token")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        tokenRef.current = data?.spotify_access_token || null;
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      if (!tokenRef.current) return;
      try {
        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        if (res.status === 204 || !res.ok) {
          setNowPlaying(null);
          return;
        }
        const data = await res.json();
        if (!data?.is_playing || !data?.item) {
          setNowPlaying(null);
          return;
        }
        setNowPlaying({
          trackId: data.item.id,
          title: data.item.name,
          artist: data.item.artists?.map((a: any) => a.name).join(", ") || "",
          artUrl: data.item.album?.images?.[0]?.url || "",
          progressMs: data.progress_ms || 0,
          durationMs: data.item.duration_ms || 0,
          isPlaying: data.is_playing,
        });
        setInterpolatedProgress(data.progress_ms || 0);
      } catch {}
    };
    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    if (nowPlaying?.isPlaying) {
      progressRef.current = setInterval(() => {
        setInterpolatedProgress((p) => Math.min(p + 1000, nowPlaying.durationMs));
      }, 1000);
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [nowPlaying]);

  const sdkActive = !!currentTrackId;
  const title = sdkActive ? sdkTitle : nowPlaying?.title;
  const artist = sdkActive ? sdkArtist : nowPlaying?.artist;
  const art = sdkActive ? sdkArt : nowPlaying?.artUrl;
  const progressMs = sdkActive ? sdkProgress : interpolatedProgress;
  const durationMs = sdkActive ? sdkDuration : nowPlaying?.durationMs || 0;
  const playing = sdkActive ? sdkPlaying : nowPlaying?.isPlaying || false;
  const spotifyTrackId = sdkActive ? currentTrackId : nowPlaying?.trackId;

  const visible = sdkActive || !!nowPlaying;
  if (!visible) return null;

  const pct = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
  const trackSaved = isSaved(spotifyTrackId || "");

  return (
    <>
      <div className="fixed left-0 right-0 z-40" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="h-[2px] w-full" style={{ backgroundColor: "#1a2535" }}>
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%`, backgroundColor: "#FF2D78" }}
          />
        </div>
        <div
          className="flex items-center gap-3 px-4 py-2 border-t border-border cursor-pointer"
          style={{ backgroundColor: "#0F1520" }}
          onClick={() => setShowDetail(true)}
        >
          {art ? (
            <img src={art} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
          ) : (
            <div
              className="h-10 w-10 rounded flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground"
              style={{ backgroundColor: "#1a2535" }}
            >
              ♪
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium" style={{ color: "#F0EBE3" }}>
              {title}
            </p>
            <p className="truncate text-[11px]" style={{ color: "#4a6a8a" }}>
              {artist}
            </p>
          </div>
          {sdkActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="h-[30px] w-[30px] rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#1a2535" }}
            >
              {playing ? (
                <Pause className="h-3.5 w-3.5" style={{ color: "#F0EBE3" }} />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" style={{ color: "#F0EBE3" }} />
              )}
            </button>
          )}
        </div>
      </div>

      {showDetail && spotifyTrackId && (
        <TrackDetailModal
          track={{
            id: spotifyTrackId,
            title: title || "",
            artist: artist || "",
            albumArtUrl: art,
            spotifyTrackId: spotifyTrackId,
            trackDbId: spotifyTrackId,
          }}
          spotifyUrl={`https://open.spotify.com/track/${spotifyTrackId}`}
          isSaved={trackSaved}
          onToggleSave={() => toggleSave(spotifyTrackId, undefined, "miniplayer")}
          onClose={() => setShowDetail(false)}
          hidePlay
        />
      )}
    </>
  );
};

export default MiniPlayer;
