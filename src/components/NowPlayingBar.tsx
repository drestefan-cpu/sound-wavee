import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NowPlaying {
  trackId: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  progressMs: number;
  durationMs: number;
}

const NowPlayingBar = () => {
  const { user } = useAuth();
  const [np, setNp] = useState<NowPlaying | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("spotify_access_token")
          .eq("id", user.id)
          .single();

        if (!profile?.spotify_access_token) { setNp(null); return; }

        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: { Authorization: `Bearer ${profile.spotify_access_token}` },
        });

        if (res.status === 204 || !res.ok) { setNp(null); return; }

        const data = await res.json();
        if (!data.is_playing || !data.item) { setNp(null); return; }

        setNp({
          trackId: data.item.id,
          title: data.item.name,
          artist: data.item.artists?.map((a: any) => a.name).join(", ") || "",
          albumArtUrl: data.item.album?.images?.[2]?.url || data.item.album?.images?.[0]?.url || "",
          progressMs: data.progress_ms || 0,
          durationMs: data.item.duration_ms || 1,
        });
      } catch {
        setNp(null);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  if (!np) return null;

  const progress = Math.min((np.progressMs / np.durationMs) * 100, 100);

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-20 cursor-pointer"
      onClick={() => window.open(`https://open.spotify.com/track/${np.trackId}`, "_blank", "noopener,noreferrer")}
      style={{ height: 56, background: "#0F1520", borderTop: "0.5px solid #1a2535" }}
    >
      <div className="mx-auto max-w-feed flex items-center gap-3 px-2 h-full">
        {np.albumArtUrl && (
          <img src={np.albumArtUrl} alt="" className="h-10 w-10 flex-shrink-0 object-cover" style={{ borderRadius: 6, marginLeft: 6 }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "#F0EBE3" }}>{np.title}</p>
          <p className="truncate" style={{ fontSize: 11, color: "#4a6a8a" }}>{np.artist}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: "#1a2535" }}>
        <div style={{ height: 2, background: "#FF2D78", width: `${progress}%`, transition: "width 1s linear" }} />
      </div>
    </div>
  );
};

export default NowPlayingBar;