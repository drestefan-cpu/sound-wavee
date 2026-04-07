import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SpotifyPlayerContextType {
  currentTrackId: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  trackTitle: string;
  trackArtist: string;
  trackArt: string;
  playerReady: boolean;
  play: (spotifyTrackId: string, title?: string, artist?: string, artUrl?: string) => void;
  togglePlayPause: () => void;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextType | undefined>(undefined);

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackArtist, setTrackArtist] = useState("");
  const [trackArt, setTrackArt] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();

  // Load SDK script
  useEffect(() => {
    if (document.getElementById("spotify-player-sdk")) return;
    const script = document.createElement("script");
    script.id = "spotify-player-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Init player when user is logged in
  useEffect(() => {
    if (!user) return;
    const initPlayer = async () => {
      const { data } = await supabase.from("profiles").select("spotify_access_token").eq("id", user.id).single();
      if (!data?.spotify_access_token) return;
      tokenRef.current = data.spotify_access_token;

      const waitForSDK = () => new Promise<void>((resolve) => {
        if ((window as any).Spotify) { resolve(); return; }
        (window as any).onSpotifyWebPlaybackSDKReady = () => resolve();
      });

      try {
        await waitForSDK();
        const player = new (window as any).Spotify.Player({
          name: "PLAI",
          getOAuthToken: (cb: (token: string) => void) => cb(tokenRef.current || ""),
          volume: 0.5,
        });

        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          setDeviceId(device_id);
          setPlayerReady(true);
        });

        player.addListener("not_ready", () => setPlayerReady(false));

        player.addListener("player_state_changed", (state: any) => {
          if (!state) return;
          const track = state.track_window?.current_track;
          if (track) {
            setCurrentTrackId(track.linked_from?.id || track.id);
            setTrackTitle(track.name || "");
            setTrackArtist(track.artists?.map((a: any) => a.name).join(", ") || "");
            setTrackArt(track.album?.images?.[0]?.url || "");
            setDuration(state.duration || 0);
            setProgress(state.position || 0);
          }
          setIsPlaying(!state.paused);
        });

        player.addListener("authentication_error", () => {
          setPlayerReady(false);
        });

        player.addListener("initialization_error", () => {
          setPlayerReady(false);
        });

        const connected = await player.connect();
        if (connected) playerRef.current = player;
      } catch {
        // SDK not available
      }
    };

    initPlayer();

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setPlayerReady(false);
      setDeviceId(null);
    };
  }, [user]);

  // Progress tracking
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (isPlaying && playerRef.current) {
      progressInterval.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState();
        if (state) setProgress(state.position || 0);
      }, 1000);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [isPlaying]);

  const play = useCallback((spotifyTrackId: string, title?: string, artist?: string, artUrl?: string) => {
    if (!playerReady || !deviceId || !tokenRef.current) {
      return; // caller should fallback
    }

    // activateElement for iOS
    playerRef.current?.activateElement?.();

    // Transfer playback
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokenRef.current}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
    }).then(res => {
      if (!res.ok) {
        toast("opening in Spotify");
      } else {
        if (title) setTrackTitle(title);
        if (artist) setTrackArtist(artist);
        if (artUrl) setTrackArt(artUrl);
        setCurrentTrackId(spotifyTrackId);
        setIsPlaying(true);
      }
    }).catch(() => {
      toast("opening in Spotify");
    });
  }, [playerReady, deviceId]);

  const togglePlayPause = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  return (
    <SpotifyPlayerContext.Provider value={{
      currentTrackId, isPlaying, progress, duration,
      trackTitle, trackArtist, trackArt, playerReady,
      play, togglePlayPause,
    }}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

export function useSpotifyPlayer() {
  const context = useContext(SpotifyPlayerContext);
  if (!context) throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider");
  return context;
}
