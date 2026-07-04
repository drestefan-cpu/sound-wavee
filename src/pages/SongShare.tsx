import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Music, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Starfield from "@/components/Starfield";
import PlaiLogo from "@/components/PlaiLogo";

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  spotify_track_id: string | null;
  apple_music_id: string | null;
  youtube_video_id: string | null;
  isrc: string | null;
  short_id: string | null;
}

interface SharerProfile {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

const SongShare = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get("from");

  const [track, setTrack] = useState<TrackRow | null>(null);
  const [sharer, setSharer] = useState<SharerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [artError, setArtError] = useState(false);

  // Share analytics — fire and forget
  useEffect(() => {
    if (!track?.id) return;
    fetch("https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/log-share-open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE",
      },
      body: JSON.stringify({
        track_id: track.id,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      }),
    }).catch(() => {});
  }, [track?.id]);

  // Dynamic OG tags once track loads
  useEffect(() => {
    if (!track) return;
    document.title = `${track.title} — ${track.artist} | PLAI`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", `${track.title} — ${track.artist}`);
    setMeta("og:description", `${track.artist} on PLAI`);
    setMeta("og:image", track.album_art_url || "https://onplai.lovable.app/plai-icon.png");
    setMeta("og:url", window.location.href);

    return () => {
      document.title = "PLAI";
    };
  }, [track]);

  // Data fetching
  useEffect(() => {
    const load = async () => {
      if (!trackId) { setLoading(false); return; }

      const trackPromise = supabase
        .from("tracks")
        .select("id, title, artist, album, album_art_url, spotify_track_id, apple_music_id, youtube_video_id, isrc, short_id")
        .eq("id", trackId)
        .maybeSingle();

      const sharerPromise = fromParam
        ? supabase
            .from("profiles")
            .select("display_name, avatar_url, username")
            .ilike("username", fromParam)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [{ data: trackData }, { data: sharerData }] = await Promise.all([
        trackPromise,
        sharerPromise,
      ]);

      setTrack(trackData as TrackRow | null);
      setSharer(sharerData as SharerProfile | null);
      setLoading(false);
    };
    load();
  }, [trackId, fromParam]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080B12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (!track) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080B12]">
        <p className="text-sm" style={{ color: "rgba(240,235,227,0.4)" }}>song not found</p>
        <a
          href="https://onplai.lovable.app"
          className="mt-3 text-xs text-primary"
        >
          go to PLAI →
        </a>
      </div>
    );
  }

  // ── Platform URL logic ────────────────────────────────────────────────────

  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  const sid = track.spotify_track_id;
  const isApple = !!sid && sid.startsWith("apple:");
  const isYouTubeSentinel = !!sid && sid.startsWith("yt:");
  const showSpotify = !!sid && !isApple && !isYouTubeSentinel;
  const appleMusicId = isApple ? sid!.slice(6) : null;
  const ytVideoId = track.youtube_video_id || (isYouTubeSentinel ? sid!.slice(3) : null);
  const appleMusicUrl = appleMusicId
    ? `https://music.apple.com/us/song/${appleMusicId}`
    : `https://music.apple.com/search?term=${q}`;
  const youtubeUrl = ytVideoId
    ? `https://www.youtube.com/watch?v=${ytVideoId}`
    : `https://www.youtube.com/results?search_query=${q}`;
  const sharerName = sharer?.display_name || sharer?.username || null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast("link copied");
  };

  const displayUrl = window.location.href.replace(/^https?:\/\//, "");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#080B12" }}>

      {/* Background: blurred album art */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
        {track.album_art_url && !artError ? (
          <img
            src={track.album_art_url}
            alt=""
            onError={() => setArtError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.3) saturate(1.2)",
              transform: "scale(1.1)", // prevents blur edge bleed
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#080B12" }} />
        )}
        {/* Dark gradient overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(8,11,18,0.3) 0%, rgba(8,11,18,0.7) 100%)",
        }} />
      </div>

      {/* Starfield */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        <Starfield />
      </div>

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}>

        {/* Sharer row */}
        {sharer && sharerName && sharer.username && (
          <Link
            to={`/profile/${sharer.username}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 32,
              color: "rgba(240,235,227,0.7)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            {sharer.avatar_url ? (
              <img
                src={sharer.avatar_url}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(255,45,120,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#FF2D78",
              }}>
                {(sharerName[0] || "?").toUpperCase()}
              </div>
            )}
            <span>{sharerName} shared this</span>
          </Link>
        )}

        {/* Glassmorphism card */}
        <div style={{
          background: "rgba(15,21,32,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: 32,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>

          {/* Album art */}
          {track.album_art_url && !artError ? (
            <img
              src={track.album_art_url}
              alt=""
              onError={() => setArtError(true)}
              style={{
                width: "100%",
                aspectRatio: "1",
                objectFit: "cover",
                borderRadius: 16,
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                display: "block",
              }}
            />
          ) : (
            <div style={{
              width: "100%", aspectRatio: "1",
              borderRadius: 16,
              background: "rgba(26,37,53,0.8)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Music style={{ width: 48, height: 48, color: "#4a6a8a" }} />
            </div>
          )}

          {/* Track info */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 500, color: "#F0EBE3", lineHeight: 1.3 }}>
              {track.title}
            </p>
            <p style={{ fontSize: 14, marginTop: 4, color: "rgba(240,235,227,0.7)" }}>
              {track.artist}
            </p>
            {track.album && (
              <p style={{ fontSize: 12, marginTop: 2, color: "rgba(240,235,227,0.4)" }}>
                {track.album}
              </p>
            )}
          </div>

          {/* Platform buttons */}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>

            {showSpotify && (
              <a
                href={`https://open.spotify.com/track/${track.spotify_track_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={btnStyle("#1DB954", "white")}
              >
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor", flexShrink: 0 }}>
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Listen on Spotify
              </a>
            )}

            <a
              href={appleMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={btnStyle("#FC3C44", "white")}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor", flexShrink: 0 }}>
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              Listen on Apple Music
            </a>

            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={btnStyle("#FF0000", "white")}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor", flexShrink: 0 }}>
                <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
              </svg>
              YouTube
            </a>

            <a
              href={`https://tidal.com/search?q=${q}`}
              target="_blank"
              rel="noopener noreferrer"
              style={btnStyleGlass()}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor", flexShrink: 0 }}>
                <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4L20.02 3.992l4.004 4.004-4.004 4.004-4.004-4.004-4.004 4.004z" />
              </svg>
              Search on Tidal
            </a>

            <a
              href={`https://music.amazon.com/search/${q}`}
              target="_blank"
              rel="noopener noreferrer"
              style={btnStyleGlass()}
            >
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>a</span>
              Search on Amazon Music
            </a>
          </div>

          {/* Copy link row */}
          <div
            onClick={handleCopyLink}
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 100,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            <LinkIcon style={{ width: 13, height: 13, color: "rgba(240,235,227,0.4)", flexShrink: 0 }} />
            <span style={{
              fontSize: 11,
              color: "rgba(240,235,227,0.5)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}>
              {displayUrl}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#FF2D78", flexShrink: 0, marginLeft: 8 }}>
              copy
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          {sharerName && sharer?.username ? (
            <Link
              to={`/profile/${sharer.username}`}
              style={{ fontSize: 12, color: "rgba(240,235,227,0.4)", textDecoration: "none" }}
            >
              see what {sharerName} is listening to on PLAI →
            </Link>
          ) : (
            <a
              href="https://onplai.lovable.app"
              style={{ fontSize: 12, color: "rgba(240,235,227,0.4)", textDecoration: "none" }}
            >
              find music with friends on PLAI →
            </a>
          )}
          <div style={{ marginTop: 12, opacity: 0.3 }}>
            <PlaiLogo className="text-sm" glow={false} />
          </div>
          <a
            href="https://onplai.lovable.app"
            style={{ fontSize: "0.75rem", color: "rgba(240,235,227,0.3)", textDecoration: "none", display: "block", marginTop: 8 }}
          >
            open in PLAI →
          </a>
        </div>

      </div>
    </div>
  );
};

// ── Button style helpers ──────────────────────────────────────────────────────

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 48,
    borderRadius: 100,
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    width: "100%",
  };
}

function btnStyleGlass(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 48,
    borderRadius: 100,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#F0EBE3",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    width: "100%",
  };
}

export default SongShare;
