import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Heart, Send, X, Play, Pause, FileText, ArrowUpRight } from "lucide-react";
import type { UnifiedTrackData } from "./UnifiedTrackCard";
import RecommendModal from "./RecommendModal";
import Artwork from "@/components/Artwork";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import { extractYouTubeVideoId, getTrackUrl } from "@/lib/trackLinks";
import { openUrl } from "@/lib/openUrl";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FriendAvatars, { loadFriendLikes, type FriendLike } from "@/components/discover/FriendAvatars";

/**
 * The song screen: full title and artist, a 30-second preview, play / save / share, the other
 * music apps, friends who love it, and "about this song" (release, length, genre, label, credits)
 * from the track-details function.
 */

interface TrackDetailModalProps {
  track: UnifiedTrackData;
  spotifyUrl: string;
  isSaved: boolean;
  onToggleSave?: () => void;
  onClose: () => void;
  hidePlay?: boolean;
  onHide?: () => void;
  isOwnTrack?: boolean;
  sharerUsername?: string;
}

interface SongDetails {
  releaseDate?: string | null;
  durationMs?: number | null;
  genre?: string | null;
  label?: string | null;
  copyright?: string | null;
  explicit?: boolean;
  previewUrl?: string | null;
  writers?: string[];
  producers?: string[];
  credits?: { role: string; names: string[] }[];
  sources?: string[];
}

const PLATFORMS: { key: string; label: string }[] = [
  { key: "spotify", label: "spotify" },
  { key: "apple_music", label: "apple music" },
  { key: "tidal", label: "tidal" },
  { key: "youtube_music", label: "youtube" },
  { key: "amazon_music", label: "amazon music" },
];

const detailsCache = new Map<string, SongDetails>();

const formatDate = (d: string) => {
  // Apple gives "2026-10-15"; some releases only have a year
  if (/^\d{4}$/.test(d)) return d;
  const date = new Date(`${d.slice(0, 10)}T12:00:00`);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const formatLength = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Log track detail view silently
const logTrackView = async (userId: string, trackId: string) => {
  try {
    await (supabase.from("track_views" as any).insert({
      user_id: userId,
      track_id: trackId,
      source_context: "detail_modal",
    }) as any);
  } catch {}
};

/** Circular progress around the preview button */
const PreviewButton = ({ playing, progress, onClick }: { playing: boolean; progress: number; onClick: () => void }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <button
      onClick={onClick}
      aria-label={playing ? "pause preview" : "play a 30-second preview"}
      className="absolute bottom-2.5 right-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform duration-150 active:scale-95"
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      {playing ? <Pause className="h-5 w-5 fill-current" strokeWidth={0} /> : <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={0} />}
    </button>
  );
};

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-foreground">{children}</dd>
  </div>
);

const TrackDetailModal = ({
  track,
  isSaved,
  onToggleSave,
  onClose,
  hidePlay = false,
  onHide,
  isOwnTrack,
  sharerUsername,
}: TrackDetailModalProps) => {
  const [showRecommend, setShowRecommend] = useState(false);
  const { user } = useAuth();
  const { preferredPlatform } = usePlatform();
  const trackDbId = track.trackDbId || (track.localOnly ? undefined : track.id);

  const [details, setDetails] = useState<SongDetails | null>(trackDbId ? detailsCache.get(trackDbId) || null : null);
  const [detailsLoading, setDetailsLoading] = useState(!!trackDbId && !detailsCache.has(trackDbId));
  const [friends, setFriends] = useState<FriendLike[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Swipe down to close (from the top of the sheet)
  const panelRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    audioRef.current?.pause();
    setClosing(true);
    setTimeout(onClose, 220);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if ((panelRef.current?.scrollTop ?? 0) > 0) return;
    drag.current = { y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current) return;
    const dy = e.touches[0].clientY - drag.current.y;
    if (dy <= 0 && !dragging) {
      drag.current = null; // scrolling the content up, not dragging
      return;
    }
    setDragging(true);
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (!drag.current) return;
    const velocity = dragY / Math.max(1, Date.now() - drag.current.t);
    drag.current = null;
    setDragging(false);
    if (dragY > 110 || (dragY > 40 && velocity > 0.6)) close();
    else setDragY(0);
  };

  const canHide = !!user && !!track.likeId && !!track.trackDbId && isOwnTrack !== false;

  // Song details (cached on the server and for this session)
  useEffect(() => {
    if (!trackDbId || detailsCache.has(trackDbId)) return;
    let cancelled = false;
    supabase.functions
      .invoke("track-details", { body: { track_id: trackDbId } })
      .then(({ data }) => {
        const d = (data?.details || null) as SongDetails | null;
        if (d) detailsCache.set(trackDbId, d);
        if (!cancelled) setDetails(d);
      })
      .catch(() => {})
      .finally(() => !cancelled && setDetailsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [trackDbId]);

  // Friends (people you follow) who love this song
  useEffect(() => {
    if (!user || !trackDbId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const ids = ((data || []) as { following_id: string }[]).map((r) => r.following_id);
      const map = await loadFriendLikes([trackDbId], ids);
      if (!cancelled) setFriends(map.get(trackDbId) || []);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, trackDbId]);

  useEffect(() => {
    if (trackDbId && user?.id) logTrackView(user.id, trackDbId);
    // Close on Escape; stop the page behind from scrolling
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePreview = () => {
    const url = details?.previewUrl;
    if (!url) return;
    if (!audioRef.current) {
      const audio = new Audio(url);
      audio.addEventListener("timeupdate", () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0));
      audio.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => toast.error("couldn't play the preview"));
    }
  };

  const urlFor = (platform: string) =>
    getTrackUrl(
      platform,
      track.spotifyTrackId,
      track.title,
      track.artist,
      track.appleMusicId,
      track.spotifyLinkId,
      track.tidalTrackId,
      track.amazonMusicId,
    );
  const ytVideoId = extractYouTubeVideoId(track.spotifyTrackId);
  const preferred = PLATFORMS.find((p) => p.key === preferredPlatform) || PLATFORMS[0];
  const otherPlatforms = PLATFORMS.filter((p) => p.key !== preferred.key);
  const year = details?.releaseDate?.slice(0, 4);

  const extraCredits = (details?.credits || []).filter((c) => c.role !== "Written by" && c.role !== "Produced by");
  const hasAbout =
    !!details &&
    !!(details.releaseDate || details.durationMs || details.genre || details.label || details.writers?.length || details.producers?.length);

  const iconButton =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-secondary transition-all duration-150 active:scale-95";

  const sheetOffset = closing ? "100%" : `${dragY}px`;

  // Rendered at the top of the page (above the bottom menu)
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center backdrop-blur-sm sm:items-center"
        style={{
          backgroundColor: `rgba(0,0,0,${closing ? 0 : 0.7 * Math.max(0.2, 1 - dragY / 400)})`,
          transition: dragging ? "none" : "background-color 0.22s ease",
        }}
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-label={`${track.title} by ${track.artist}`}
      >
        <div
          ref={panelRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="relative max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card px-5 motion-safe:animate-sheet-up sm:mx-4 sm:max-w-sm sm:rounded-2xl sm:motion-safe:animate-pop-in"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
            transform: `translateY(${sheetOffset})`,
            transition: dragging ? "none" : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* top bar */}
          <div className="sticky top-0 z-10 -mx-5 mb-1 flex h-11 items-center justify-center bg-card px-5">
            <span className="h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <button
              onClick={close}
              aria-label="close"
              className="absolute right-3 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* cover + preview */}
          <div className="relative mx-auto aspect-square w-[74%] max-w-[300px] overflow-hidden rounded-2xl bg-secondary shadow-lg">
            <Artwork
              src={track.albumArtUrl}
              eager
              fallback={<div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">♪</div>}
            />
            {details?.previewUrl && <PreviewButton playing={playing} progress={progress} onClick={togglePreview} />}
          </div>

          {/* title */}
          <div className="mt-4 space-y-1 text-center">
            <h2 className="break-words text-xl font-semibold leading-tight text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
              {track.title}
            </h2>
            <p className="break-words text-[15px] text-foreground/80">{track.artist}</p>
            {(track.album || year || details?.explicit) && (
              <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted-foreground">
                {track.album && <span className="break-words">{track.album}</span>}
                {track.album && year && <span aria-hidden="true">·</span>}
                {year && <span>{year}</span>}
                {details?.explicit && (
                  <span className="rounded-[3px] bg-muted-foreground/20 px-1 text-[9px] font-semibold leading-4 text-muted-foreground" title="explicit">
                    E
                  </span>
                )}
              </p>
            )}
          </div>

          {/* actions */}
          <div className="mt-5 flex items-center gap-2.5">
            {!hidePlay && (
              <button
                onClick={() => openUrl(urlFor(preferred.key))}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-all duration-150 active:scale-[0.98]"
              >
                <Play className="h-4 w-4 shrink-0 fill-current" strokeWidth={0} />
                <span className="truncate">play on {preferred.key === "youtube_music" ? "youtube music" : preferred.label}</span>
              </button>
            )}
            {isOwnTrack ? (
              <div className={`${iconButton} cursor-default opacity-50`} title="this song is in your collection" aria-label="in your collection">
                <Heart className="h-5 w-5 fill-primary text-primary" strokeWidth={0} />
              </div>
            ) : (
              <button onClick={onToggleSave} aria-label={isSaved ? "saved — tap to remove" : "save"} aria-pressed={isSaved} className={iconButton}>
                <Heart
                  className={`h-5 w-5 ${isSaved ? "fill-primary text-primary" : "text-foreground/70"}`}
                  strokeWidth={isSaved ? 0 : 2}
                />
              </button>
            )}
            <button onClick={() => setShowRecommend(true)} aria-label="share" className={iconButton}>
              <Send className="h-[18px] w-[18px] text-foreground/70" strokeWidth={2} />
            </button>
          </div>

          {/* other apps */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 text-xs">
            <span className="mr-1 text-[11px] text-muted-foreground">also on</span>
            {otherPlatforms.map((p) => (
              <button
                key={p.key}
                onClick={() => openUrl(urlFor(p.key))}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
            {ytVideoId && (
              <button
                onClick={() => openUrl(`https://www.youtube.com/watch?v=${ytVideoId}`)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground"
              >
                youtube video
              </button>
            )}
          </div>

          {friends.length > 0 && (
            <div className="mt-3 flex justify-center">
              <FriendAvatars friends={friends} verb="loved by" />
            </div>
          )}

          {/* about */}
          {trackDbId && (detailsLoading || hasAbout) && (
            <section className="mt-6 border-t border-border pt-4">
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">about this song</h3>
              {detailsLoading ? (
                <div className="space-y-3 py-2" aria-label="loading song details">
                  {[70, 50, 60].map((w) => (
                    <div key={w} className="h-3.5 animate-pulse rounded bg-secondary" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                details && (
                  <dl className="divide-y divide-border/60">
                    {details.releaseDate && <InfoRow label="released">{formatDate(details.releaseDate)}</InfoRow>}
                    {details.durationMs ? <InfoRow label="length">{formatLength(details.durationMs)}</InfoRow> : null}
                    {details.genre && <InfoRow label="genre">{details.genre}</InfoRow>}
                    {details.writers && details.writers.length > 0 && <InfoRow label="written by">{details.writers.join(", ")}</InfoRow>}
                    {details.producers && details.producers.length > 0 && <InfoRow label="produced by">{details.producers.join(", ")}</InfoRow>}
                    {extraCredits.map((c) => (
                      <InfoRow key={c.role} label={c.role.toLowerCase()}>
                        {c.names.join(", ")}
                      </InfoRow>
                    ))}
                    {details.label && <InfoRow label="label">{details.label}</InfoRow>}
                  </dl>
                )
              )}
            </section>
          )}

          {/* lyrics */}
          <button
            onClick={() => openUrl(`https://genius.com/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`)}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/50"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">lyrics</span>
            <span className="text-xs text-muted-foreground">genius</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {details?.copyright && <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">{details.copyright}</p>}
          {details?.sources && details.sources.length > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">details from {details.sources.join(", ")}</p>
          )}

          {canHide && (
            <button
              onClick={async () => {
                if (!user || !track.trackDbId) return;
                try {
                  const { data: exclusion } = await (supabase
                    .from("collection_exclusions" as any)
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("track_id", track.trackDbId)
                    .maybeSingle() as any);
                  if (exclusion) {
                    await (supabase.from("hidden_tracks" as any).delete().eq("user_id", user.id).eq("track_id", track.trackDbId) as any);
                    toast("song is already removed from your collection");
                  } else {
                    await (supabase.from("hidden_tracks" as any).insert({ user_id: user.id, track_id: track.trackDbId }) as any);
                    toast("song hidden from your collection — find it in your hidden tab");
                  }
                  onClose();
                  onHide?.();
                } catch {
                  toast.error("couldn't hide song — try again");
                }
              }}
              className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              hide from my collection
            </button>
          )}
        </div>
      </div>
      {showRecommend && (
        <div className="relative z-[70]">
          <RecommendModal
            trackId={track.trackDbId || track.id}
            trackTitle={track.title}
            trackArtist={track.artist}
            shortId={track.shortId}
            sharerUsername={sharerUsername}
            onClose={() => setShowRecommend(false)}
          />
        </div>
      )}
    </>,
    document.body,
  );
};

export default TrackDetailModal;
