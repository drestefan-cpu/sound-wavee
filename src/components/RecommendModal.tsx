import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, Share2, Link as LinkIcon, Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { followArtistForTrack } from "@/lib/followedArtists";
import { songShareUrl } from "@/lib/shareLinks";
import { useSheetDrag } from "@/hooks/useSheetDrag";

/**
 * The share sheet: share / copy the PLAI link, or send the song to friends on PLAI.
 * Friends = people you follow or who follow you, most-sent-to first. Pick several, add one message.
 */

interface RecommendModalProps {
  trackId: string;
  trackTitle: string;
  trackArtist?: string;
  /** Share code for a short link (falls back to the long /song/ link) */
  shortId?: string | null;
  /** Current user's username — shared links show "<username> shared this" */
  sharerUsername?: string;
  onClose: () => void;
}

interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  relation: "mutual" | "following" | "follower";
  sent_count: number;
  already_sent: boolean;
}

const MAX_MESSAGE = 75;

const Avatar = ({ f }: { f: Friend }) => (
  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/20">
    {f.avatar_url ? (
      <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
        {(f.display_name || f.username)[0]?.toUpperCase()}
      </div>
    )}
  </div>
);

const RecommendModal = ({ trackId, trackTitle, trackArtist, shortId, sharerUsername, onClose }: RecommendModalProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { panelRef, handlers, sheetStyle, backdropStyle, close } = useSheetDrag(onClose);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .rpc("recommend_candidates", { p_track_id: trackId })
      .then(({ data }: { data: Friend[] | null }) => {
        setFriends(data || []);
        setLoading(false);
      });
  }, [user, trackId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PLAI song page link (rich preview with album art in iMessage etc.)
  const shareUrl = songShareUrl(trackId, { shortId, from: sharerUsername });
  const shareTitle = trackArtist ? `${trackTitle} — ${trackArtist}` : trackTitle;

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast("link copied"))
      .catch(() => toast.error("couldn't copy — try again"));
  };

  // Opens the phone's share sheet; on computers without one, copies the link instead
  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {}); // cancelled
    } else {
      handleCopyLink();
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q) || (f.display_name || "").toLowerCase().includes(q));
  }, [friends, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSend = async () => {
    if (!user || selected.size === 0 || sending) return;
    setSending(true);
    const rows = [...selected].map((to) => ({
      from_user_id: user.id,
      to_user_id: to,
      track_id: trackId,
      message: message.trim() || null,
    }));
    const { error } = await (supabase.from("recommendations" as any).insert(rows as any) as any);
    setSending(false);
    if (error) {
      if (error.code === "23505") toast.error("you've already sent this song to one of them");
      else if (error.code === "P0001") toast.error(error.message);
      else toast.error("couldn't send — try again");
      return;
    }
    followArtistForTrack(user.id, trackId, "sent_track").catch(() => {});
    const names = friends.filter((f) => selected.has(f.id)).map((f) => `@${f.username}`);
    toast.success(names.length === 1 ? `sent to ${names[0]}` : `sent to ${names.length} friends`);
    close();
  };

  const relationHint = (f: Friend) => {
    if (f.already_sent) return "already sent";
    if (f.sent_count > 0) return `you've sent ${f.sent_count} ${f.sent_count === 1 ? "song" : "songs"}`;
    if (f.relation === "follower") return "follows you";
    if (f.relation === "following") return "you follow";
    return "friends";
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center backdrop-blur-sm sm:items-center"
      style={backdropStyle}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`share ${trackTitle}`}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card motion-safe:animate-sheet-up sm:mx-4 sm:max-w-md sm:rounded-2xl sm:motion-safe:animate-pop-in"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header (drag it down to close; the friends list scrolls on its own) */}
        <div className="relative shrink-0 px-5 pb-3 pt-2" {...handlers}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <button
            onClick={close}
            aria-label="close"
            className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">share</p>
          <p className="mt-0.5 truncate pr-8 text-base font-semibold text-foreground">{trackTitle}</p>
          {trackArtist && <p className="truncate text-xs text-muted-foreground">{trackArtist}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={handleNativeShare}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-foreground transition-all active:scale-[0.98]"
              style={{ touchAction: "manipulation" }}
            >
              <Share2 className="h-4 w-4" />
              share link
            </button>
            <button
              onClick={handleCopyLink}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-foreground transition-all active:scale-[0.98]"
              style={{ touchAction: "manipulation" }}
            >
              <LinkIcon className="h-4 w-4" />
              copy link
            </button>
          </div>
        </div>

        {/* friends */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-5 pb-4 pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">send on PLAI</p>

          {friends.length > 6 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="recommend-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search friends"
                className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-secondary" />
                  <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-foreground">No friends on PLAI yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Follow people to send them songs here.</p>
              <Link to="/feed" onClick={close} className="mt-3 inline-block text-xs text-primary">
                find people →
              </Link>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">no friends match "{query}"</p>
          ) : (
            <ul className="space-y-1">
              {visible.map((f) => {
                const isOn = selected.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => !f.already_sent && toggle(f.id)}
                      disabled={f.already_sent}
                      aria-pressed={isOn}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                        f.already_sent ? "opacity-50" : isOn ? "bg-primary/10" : "hover:bg-secondary/60"
                      }`}
                    >
                      <Avatar f={f} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{f.display_name || f.username}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{f.username} · {relationHint(f)}
                        </p>
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isOn || f.already_sent ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {(isOn || f.already_sent) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* send bar */}
        {selected.size > 0 && (
          <div
            className="shrink-0 border-t border-border bg-card px-5 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
          >
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="recommend-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                  placeholder="add a message…"
                  className="h-11 w-full rounded-full border border-border bg-background pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground"
                />
                {message.length > 0 && (
                  <span
                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                      message.length >= MAX_MESSAGE - 5 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {MAX_MESSAGE - message.length}
                  </span>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={sending}
                className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? "sending…" : selected.size === 1 ? "send" : `send to ${selected.size}`}
              </button>
            </div>
          </div>
        )}
        {selected.size === 0 && <div className="shrink-0" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
      </div>
    </div>,
    document.body,
  );
};

export default RecommendModal;
