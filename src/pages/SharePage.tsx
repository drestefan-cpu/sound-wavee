import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Music } from "lucide-react";
import Starfield from "@/components/Starfield";
import PlaiLogo from "@/components/PlaiLogo";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

interface TrackResult {
  title: string;
  artist: string;
  album_art_url: string | null;
  spotify_track_id: string | null;
  apple_music_id: string | null;
  youtube_video_id: string | null;
}

interface ShareResult {
  share_url: string;
  short_url: string | null;
  track: TrackResult;
}

// ── Platform URL helpers (same logic as SongShare) ────────────────────────────

function getPlatformLinks(track: TrackResult) {
  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  const sid = track.spotify_track_id;
  const isApple = !!sid && sid.startsWith("apple:");
  const isYtSentinel = !!sid && sid.startsWith("yt:");
  const showSpotify = !!sid && !isApple && !isYtSentinel;
  const appleMusicId = isApple ? sid!.slice(6) : (track.apple_music_id ?? null);
  const ytVideoId = track.youtube_video_id ?? (isYtSentinel ? sid!.slice(3) : null);

  return {
    spotify: showSpotify ? `https://open.spotify.com/track/${sid}` : null,
    appleMusic: appleMusicId
      ? `https://music.apple.com/us/song/${appleMusicId}`
      : `https://music.apple.com/search?term=${q}`,
    youtube: ytVideoId
      ? `https://music.youtube.com/watch?v=${ytVideoId}`
      : `https://music.youtube.com/search?q=${q}`,
    tidal: `https://tidal.com/search?q=${q}`,
    amazon: `https://music.amazon.com/search/${q}`,
  };
}

// ── YouTube video ID extractor ────────────────────────────────────────────────

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    return null;
  } catch {
    return null;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "rgba(15,21,32,0.7)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 20,
  maxWidth: 440,
  width: "100%",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  maxHeight: "calc(100dvh - 80px)",
  overflowY: "auto",
};

// ── Component ─────────────────────────────────────────────────────────────────

const SharePage = () => {
  const [searchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmittedUrlRef = useRef<string | null>(null);

  const submitUrl = useCallback(async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/create-share-link",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ url: trimmedUrl }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setResult(data as ShareResult);
      } else {
        const ytVideoId = extractYouTubeVideoId(trimmedUrl);
        if (ytVideoId) {
          setResult({
            share_url: trimmedUrl,
            short_url: null,
            track: {
              title: "YouTube video",
              artist: "",
              album_art_url: null,
              spotify_track_id: null,
              apple_music_id: null,
              youtube_video_id: ytVideoId,
            },
          });
        } else {
          setError(data.error || "couldn't find that song — try a different link");
        }
      }
    } catch {
      setError("something went wrong — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    const queryUrl = searchParams.get("url")?.trim();
    if (!queryUrl) return;

    setInputValue(queryUrl);

    if (searchParams.get("auto") !== "1") return;
    if (autoSubmittedUrlRef.current === queryUrl) return;

    autoSubmittedUrlRef.current = queryUrl;
    submitUrl(queryUrl);
  }, [searchParams, submitUrl]);

  const handleSubmit = () => {
    submitUrl(inputValue);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const shareUrl = result?.short_url || result?.share_url || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast("link copied ✓");
  };

  const handleNativeShare = () => {
    if (!result) return;
    navigator.share({
      title: `${result.track.title} — ${result.track.artist}`,
      url: shareUrl,
    });
  };

  return (
    <div style={{ position: "relative", height: "100dvh", overflow: "hidden", background: "#080B12" }}>
      {/* Starfield */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        <Starfield />
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 24px",
        }}
      >
        {/* Top bar */}
        <div style={{ width: "100%", maxWidth: 440, marginBottom: 16 }}>
          <PlaiLogo className="text-base" />
        </div>

        {/* Main card */}
        <div style={card}>
          {!result ? (
            /* ── Input state ── */
            <>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="paste a music link..."
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${error ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  padding: 12,
                  color: "#F0EBE3",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = "#FF2D78";
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              />

              {error && (
                <p style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{error}</p>
              )}

              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 12,
                    padding: "11px 0",
                  }}
                >
                  <div
                    className="animate-spin"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,45,120,0.3)",
                      borderTopColor: "#FF2D78",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "#4a6a8a" }}>finding your song...</span>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim()}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    background: inputValue.trim() ? "#FF2D78" : "rgba(255,45,120,0.3)",
                    borderRadius: 100,
                    padding: "11px 0",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "white",
                    border: "none",
                    cursor: inputValue.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                    transition: "background 0.15s",
                  }}
                >
                  generate link →
                </button>
              )}
            </>
          ) : (
            /* ── Success state ── */
            <>
              {/* Track preview */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {result.track.album_art_url ? (
                  <img
                    src={result.track.album_art_url}
                    alt=""
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: "rgba(26,37,53,0.8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Music style={{ width: 28, height: 28, color: "#4a6a8a" }} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#F0EBE3",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {result.track.title}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#4a6a8a",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {result.track.artist}
                  </p>

                  {/* Platform pills */}
                  <PlatformPills track={result.track} />
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "14px 0" }} />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 100,
                  padding: "8px 14px",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "#FF2D78",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shareUrl.replace(/^https?:\/\//, "")}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(240,235,227,0.6)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginLeft: 8,
                    flexShrink: 0,
                    fontFamily: "inherit",
                  }}
                >
                  copy
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1,
                    background: "#FF2D78",
                    borderRadius: 100,
                    padding: "11px 0",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  copy link
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    style={{
                      flex: 1,
                      background: "transparent",
                      borderRadius: 100,
                      padding: "11px 0",
                      fontSize: 14,
                      color: "#F0EBE3",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    share
                  </button>
                )}
              </div>

              {/* Try another */}
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button
                  onClick={handleReset}
                  style={{
                    fontSize: 12,
                    color: "#4a6a8a",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  try another →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Platform pills sub-component ──────────────────────────────────────────────

const PlatformPills = ({ track }: { track: TrackResult }) => {
  const links = getPlatformLinks(track);
  const pills: { label: string; href: string; bg: string; color: string; border?: string }[] = [];

  if (links.spotify) {
    pills.push({ label: "Spotify", href: links.spotify, bg: "#1DB954", color: "white" });
  }
  pills.push({ label: "Apple Music", href: links.appleMusic, bg: "#FC3C44", color: "white" });
  pills.push({ label: "YouTube", href: links.youtube, bg: "#FF0000", color: "white" });
  pills.push({
    label: "Tidal",
    href: links.tidal,
    bg: "rgba(255,255,255,0.06)",
    color: "#F0EBE3",
    border: "1px solid rgba(255,255,255,0.1)",
  });
  pills.push({
    label: "Amazon",
    href: links.amazon,
    bg: "rgba(255,255,255,0.06)",
    color: "#F0EBE3",
    border: "1px solid rgba(255,255,255,0.1)",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginTop: 8,
        overflowX: "auto",
        scrollbarWidth: "none",
        paddingBottom: 2,
      }}
    >
      {pills.map((p) => (
        <a
          key={p.label}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10,
            padding: "3px 10px",
            borderRadius: 100,
            background: p.bg,
            color: p.color,
            border: p.border ?? "none",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {p.label}
        </a>
      ))}
    </div>
  );
};

export default SharePage;
