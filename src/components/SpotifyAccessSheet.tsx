import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSheetDrag } from "@/hooks/useSheetDrag";
import { SPOTIFY_BLOCKED_KEY } from "@/lib/oauthReturn";

/**
 * Shown when Spotify turns someone away (PLAI's Spotify app only lets approved people connect).
 * They leave their Spotify email → André gets a notification → once he's added them in Spotify's
 * dashboard and marked it, they're told. Meanwhile they can join with a public playlist.
 */

export const SPOTIFY_REQUEST_EMAIL_KEY = "plai-spotify-request-email";
const CONTACT = "andre@delaneyprojects.xyz";

const SpotifyAccessSheet = () => {
  const { user, signInWithSpotify } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    try {
      // (kept until they close the sheet: the app may reload once right after arriving)
      const r = sessionStorage.getItem(SPOTIFY_BLOCKED_KEY);
      if (!r) return;
      if (r === "cancelled") {
        sessionStorage.removeItem(SPOTIFY_BLOCKED_KEY);
        toast("Spotify sign-in cancelled");
      } else setReason(r);
    } catch {}
    // opened from the app (e.g. "continue with Spotify" when the spots are full)
    const open = (e: Event) => setReason((e as CustomEvent<string>).detail || "blocked");
    window.addEventListener("plai-spotify-access", open);
    return () => window.removeEventListener("plai-spotify-access", open);
  }, []);

  const { panelRef, handlers, sheetStyle, backdropStyle, close } = useSheetDrag(() => {
    try {
      sessionStorage.removeItem(SPOTIFY_BLOCKED_KEY);
    } catch {}
    setReason(null);
  });
  if (!reason) return null;

  const signedIn = !!user && !user.is_anonymous;
  const full = reason === "full";

  const request = async () => {
    setSending(true);
    const { error } = await (supabase as any).rpc("request_spotify_access", { p_email: email, p_name: name || null });
    setSending(false);
    if (error) {
      toast.error(error.code === "P0001" ? error.message : "couldn't send — try again, or email " + CONTACT);
      return;
    }
    try {
      localStorage.setItem(SPOTIFY_REQUEST_EMAIL_KEY, email.trim().toLowerCase());
    } catch {}
    setSent(true);
  };

  // Join now with a username + PIN, then connect a public Spotify playlist
  const joinWithPlaylist = async () => {
    if (signedIn) {
      close();
      navigate("/settings#connected-platforms");
      return;
    }
    setJoining(true);
    try {
      if (!user) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      sessionStorage.setItem("plai-signup", JSON.stringify({ platform: "spotify", name }));
      close();
      navigate("/", { replace: true });
    } catch {
      toast.error("couldn't start — try again");
    } finally {
      setJoining(false);
    }
  };

  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent("PLAI Spotify access")}&body=${encodeURIComponent(
    `Hi André, can you add me to PLAI's Spotify list?\n\nMy Spotify email: ${email || "(your Spotify email)"}`,
  )}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center backdrop-blur-sm sm:items-center"
      style={backdropStyle}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Spotify access"
    >
      <div
        ref={panelRef}
        {...handlers}
        className="relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card px-5 motion-safe:animate-sheet-up sm:mx-4 sm:max-w-sm sm:rounded-2xl"
        style={{ ...sheetStyle, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-5 flex h-11 items-center justify-center bg-card px-5">
          <span className="h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <button
            onClick={close}
            aria-label="close"
            className="absolute right-3 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {full && (
          <>
            <h2 className="text-base font-semibold text-foreground">Spotify accounts are full right now</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              While PLAI is new, Spotify only lets 5 accounts connect, and they're all taken. You can still join with a
              public Spotify playlist of your favourite songs. It works straight away.
            </p>
            <button
              onClick={joinWithPlaylist}
              disabled={joining}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
            >
              {joining ? "one sec…" : signedIn ? "connect a playlist →" : "join with a playlist →"}
            </button>
            <button
              onClick={() => {
                close();
                signInWithSpotify({ force: true });
              }}
              className="mt-2.5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              already one of the 5? continue with Spotify
            </button>
            <div className="my-5 border-t border-border" />
            <p className="text-xs font-medium text-foreground">Want a spot when one opens?</p>
          </>
        )}

        {!sent ? (
          <>
            {!full && (
              <>
                <h2 className="text-base font-semibold text-foreground">Spotify needs to approve you first</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  PLAI is new, so Spotify only lets people André has added connect. Leave the email you use for Spotify
                  and he'll add you, usually within a day.
                </p>
              </>
            )}
            <div className="mt-4 space-y-2.5">
              <input
                id="spotify-request-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your Spotify email"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <input
                id="spotify-request-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="your name (so André knows who you are)"
                autoComplete="name"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                onClick={request}
                disabled={sending || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}
                className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                {sending ? "sending…" : full ? "join the waitlist" : "request access"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-foreground">{full ? "You're on the waitlist ✓" : "Request sent ✓"}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {full ? "When a spot opens, André can add " : "André's been told. Once he's added "}
              <span className="text-foreground">{email.trim().toLowerCase()}</span>
              {full ? " and you'll be told." : ", continue with Spotify will work."}
            </p>
          </>
        )}

        {!full && (
        <div className="mt-5 rounded-2xl border border-border p-4">
          <p className="text-sm font-medium text-foreground">Don't want to wait?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {signedIn
              ? "Connect a public Spotify playlist of your favourite songs in Settings. It works straight away."
              : "Join now with a username and PIN, then add a public Spotify playlist of your favourite songs. It works straight away, and you'll hear when Spotify's ready."}
          </p>
          <button
            onClick={joinWithPlaylist}
            disabled={joining}
            className="mt-3 w-full rounded-full border border-primary/60 px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            {joining ? "one sec…" : signedIn ? "connect a playlist →" : "join with a playlist →"}
          </button>
        </div>
        )}

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Questions? <span className="text-foreground">{CONTACT}</span> ·{" "}
          <a href={mailto} className="text-primary underline-offset-2 hover:underline">
            email André
          </a>
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default SpotifyAccessSheet;
