import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";
import { getRandomTagline } from "@/lib/taglines";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
const APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

const Landing = () => {
  const { user, loading, signInWithSpotify } = useAuth();
  const navigate = useNavigate();
  const [tagline, setTagline] = useState("i love your taste");
  const [fade, setFade] = useState(true);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showAppleOnboarding, setShowAppleOnboarding] = useState(false);
  const [anonUserId, setAnonUserId] = useState<string | null>(null);
  const [onboardingUsername, setOnboardingUsername] = useState("");
  const [onboardingPin, setOnboardingPin] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [pinUsername, setPinUsername] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTagline((prev) => getRandomTagline(prev));
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = (navigator as any).standalone === true;
    if (isIOS && !isStandalone) {
      setShowInstallOverlay(true);
    }
  }, []);

  const dismissInstall = () => {
    setShowInstallOverlay(false);
  };

  const connectYouTube = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/youtube",
        redirectTo: window.location.origin + "/auth/google/callback",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) toast.error("Could not connect to Google");
  };

  const connectAppleMusic = async () => {
    setAppleLoading(true);
    try {
      // 1. Fetch developer token from our edge function
      const devTokenRes = await fetch(`${SUPABASE_URL}/functions/v1/apple-music-developer-token`, {
        method: "POST",
        headers: { apikey: APIKEY, "Content-Type": "application/json" },
      });
      const { token: developerToken, error: tokenError } = await devTokenRes.json();
      if (!developerToken) throw new Error(tokenError || "Could not get developer token");

      // 2. Load MusicKit JS v3 if not already present
      await new Promise<void>((resolve, reject) => {
        if ((window as any).MusicKit) { resolve(); return; }
        const script = document.createElement("script");
        script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load MusicKit JS"));
        document.head.appendChild(script);
      });

      // 3. Configure MusicKit
      await (window as any).MusicKit.configure({
        developerToken,
        app: { name: "PLAI", build: "1.0" },
      });
      const music = (window as any).MusicKit.getInstance();

      // 4. Authorize — opens Apple Music sign-in
      const userToken = await music.authorize();
      if (!userToken) throw new Error("Authorization cancelled");

      // 5. Get existing session or create anonymous account for standalone Apple Music users
      let isAnonymousFlow = false;
      let { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;

      if (!userId) {
        isAnonymousFlow = true;
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError || !anonData.user) throw new Error("Could not create account — please try again");
        userId = anonData.user.id;
        const { data: refreshed } = await supabase.auth.getSession();
        session = refreshed.session;
      }

      const authToken = session?.access_token || APIKEY;

      // 6. Store user token in profiles
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: userId, apple_music_user_token: userToken } as any, { onConflict: "id" });
      if (upsertError) throw new Error("Could not save Apple Music token");

      // 7. Trigger sync — fire and forget
      fetch(`${SUPABASE_URL}/functions/v1/sync-apple-music-likes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: APIKEY,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {});

      if (isAnonymousFlow) {
        // Prompt user to set username + PIN before entering the app
        setAnonUserId(userId);
        setOnboardingUsername("");
        setOnboardingPin("");
        setShowAppleOnboarding(true);
      } else {
        toast.success("Apple Music connected!");
        navigate("/feed");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("abort")) {
        toast.error("Apple Music sign in cancelled");
      } else {
        toast.error("Could not connect Apple Music — please try again");
        console.error("Apple Music auth error:", err);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleAppleOnboarding = async () => {
    const cleanUsername = onboardingUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!cleanUsername || cleanUsername.length < 2) {
      toast.error("username must be at least 2 characters");
      return;
    }
    if (!/^\d{4}$/.test(onboardingPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (!anonUserId) return;

    setOnboardingLoading(true);
    try {
      const { error: usernameError } = await supabase
        .from("profiles")
        .update({ username: cleanUsername, display_name: cleanUsername } as any)
        .eq("id", anonUserId);
      if (usernameError) {
        if (usernameError.code === "23505") {
          toast.error("that username is taken — try another");
          return;
        }
        throw usernameError;
      }

      const { error: pinError } = await supabase.functions.invoke("setup-apple-pin", {
        body: { pin: onboardingPin },
      });
      if (pinError) throw pinError;

      toast.success("Welcome to PLAI!");
      navigate("/feed");
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error("Couldn't set up your account — please try again");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handlePinLogin = async () => {
    const cleanUsername = pinUsername.toLowerCase().trim();
    if (!cleanUsername || !/^\d{4}$/.test(pinValue)) return;

    setPinLoading(true);
    try {
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .single();

      if (lookupError || !profile) {
        toast.error("username not found");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: `${profile.id}@plai.device`,
        password: pinValue,
      });

      if (signInError) {
        toast.error("wrong PIN — try again");
        return;
      }

      navigate("/feed");
    } catch {
      toast.error("sign in failed — try again");
    } finally {
      setPinLoading(false);
    }
  };

  const connectTidal = async () => {
    try {
      const array = new Uint8Array(64);
      crypto.getRandomValues(array);
      const codeVerifier = btoa(String.fromCharCode(...array))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await crypto.subtle.digest("SHA-256", data);
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      localStorage.setItem("tidal_code_verifier", codeVerifier);
      localStorage.removeItem("tidal_user_id");

      const { data: result } = await supabase.functions.invoke("tidal-auth-url", {
        body: {
          code_challenge: codeChallenge,
          redirect_uri: `${window.location.origin}/auth/tidal/callback`,
        },
      });

      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Could not start Tidal login");
      }
    } catch {
      toast.error("Could not connect to Tidal");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Starfield />

      {/* Full screen install overlay — iOS only */}
      {showInstallOverlay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,11,18,0.95)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              width: "100%",
              background: "#0F1520",
              borderTop: "0.5px solid #1a2535",
              borderRadius: "24px 24px 0 0",
              padding: "12px 24px 52px",
              textAlign: "center",
            }}
          >
            <div style={{ width: 36, height: 4, background: "#1a2535", borderRadius: 2, margin: "0 auto 28px" }} />
            <img
              src="/plai-icon.png"
              alt="PLAI"
              style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 16 }}
            />
            <p style={{ fontSize: 22, fontWeight: 600, color: "#F0EBE3", marginBottom: 8 }}>
              save PLAI to your home screen
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#4a6a8a",
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 260,
                margin: "0 auto 32px",
              }}
            >
              get the full app experience before you sign in
            </p>
            <div
              style={{
                background: "#080B12",
                border: "0.5px solid #1a2535",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 28,
                textAlign: "left",
              }}
            >
              {[
                <span>
                  tap the <span style={{ color: "#FF2D78", fontWeight: 500 }}>Share</span> button{" "}
                  <svg
                    style={{ display: "inline", verticalAlign: "middle", marginBottom: 2 }}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FF2D78"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>{" "}
                  at the bottom of Safari
                </span>,
                <span>
                  scroll down and tap <span style={{ color: "#FF2D78", fontWeight: 500 }}>"Add to Home Screen"</span>
                </span>,
                <span>
                  tap <span style={{ color: "#FF2D78", fontWeight: 500 }}>Add</span> — then open PLAI from your home
                  screen
                </span>,
              ].map((text, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 2 ? 16 : 0 }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#FF2D78",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 13, color: "#F0EBE3", lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={dismissInstall}
              style={{
                width: "100%",
                padding: "15px",
                background: "#FF2D78",
                color: "white",
                border: "none",
                borderRadius: 100,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                marginBottom: 12,
              }}
            >
              got it
            </button>
            <button
              onClick={dismissInstall}
              style={{ background: "none", border: "none", color: "#2a3a4a", fontSize: 11, cursor: "pointer" }}
            >
              skip for now
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-10 text-center">
        <p className="text-[10px] font-light uppercase tracking-[0.3em] text-primary">
          from old provençal — it pleases me
        </p>

        <PlaiLogo className="text-7xl" />

        <p
          className="max-w-xs font-light text-muted-foreground transition-opacity duration-400"
          style={{ fontSize: "1.05rem", opacity: fade ? 1 : 0 }}
        >
          {tagline}
        </p>

        {showAppleOnboarding ? (
          /* ── Apple Music onboarding ── */
          <div className="flex w-full flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              set a username and PIN<br />so you can sign back in next time
            </p>
            <input
              value={onboardingUsername}
              onChange={(e) => setOnboardingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-2xl bg-card border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              style={{ touchAction: "manipulation" }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={onboardingPin}
              onChange={(e) => setOnboardingPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4-digit PIN"
              className="w-full rounded-2xl bg-card border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-center tracking-[0.5em]"
              style={{ touchAction: "manipulation" }}
            />
            <button
              onClick={handleAppleOnboarding}
              disabled={onboardingLoading || onboardingUsername.length < 2 || onboardingPin.length !== 4}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-60"
              style={{ touchAction: "manipulation" }}
            >
              {onboardingLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : "create my PLAI →"}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setShowAppleOnboarding(false);
                setAnonUserId(null);
                setOnboardingUsername("");
                setOnboardingPin("");
              }}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              style={{ touchAction: "manipulation" }}
            >
              ← use Spotify or YouTube instead
            </button>
          </div>
        ) : showPinLogin ? (
          /* ── PIN login ── */
          <div className="flex w-full flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">sign in with your PIN</p>
            <input
              value={pinUsername}
              onChange={(e) => setPinUsername(e.target.value.toLowerCase())}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-2xl bg-card border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              style={{ touchAction: "manipulation" }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN"
              className="w-full rounded-2xl bg-card border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-center tracking-[0.5em]"
              style={{ touchAction: "manipulation" }}
            />
            <button
              onClick={handlePinLogin}
              disabled={pinLoading || !pinUsername.trim() || pinValue.length !== 4}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-60"
              style={{ touchAction: "manipulation" }}
            >
              {pinLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : "sign in →"}
            </button>
            <button
              onClick={() => { setShowPinLogin(false); setPinUsername(""); setPinValue(""); }}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              style={{ touchAction: "manipulation" }}
            >
              ← back
            </button>
          </div>
        ) : (
          /* ── Default: platform buttons ── */
          <>
            <div className="flex w-full flex-col gap-3">
              <button
                onClick={signInWithSpotify}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                style={{ touchAction: "manipulation" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                continue with Spotify
              </button>

              <button
                onClick={connectYouTube}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                style={{ touchAction: "manipulation" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                </svg>
                continue with YouTube Music
              </button>

              <button
                onClick={connectAppleMusic}
                disabled={appleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-60"
                style={{ touchAction: "manipulation" }}
              >
                {appleLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                  </svg>
                )}
                {appleLoading ? "connecting…" : "continue with Apple Music"}
              </button>

              <button
                onClick={connectTidal}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
                style={{ touchAction: "manipulation" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4L20.02 3.992l4.004 4.004-4.004 4.004-4.004-4.004-4.004 4.004z" />
                </svg>
                continue with Tidal
              </button>
            </div>

            <p className="text-xs text-muted-foreground/40">Come have a good time</p>
            <button
              onClick={() => setShowPinLogin(true)}
              className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors mt-1"
              style={{ touchAction: "manipulation" }}
            >
              returning with Apple Music? sign in with PIN →
            </button>
          </>
        )}
      </div>

      <AndroidInstallPrompt />
    </div>
  );
};

const AndroidInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 8000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <button
        onClick={() => {
          deferredPrompt.prompt();
          setVisible(false);
        }}
        className="rounded-full px-5 py-2 text-xs font-medium text-primary-foreground"
        style={{ background: "#FF2D78", touchAction: "manipulation" }}
      >
        add PLAI to your home screen →
      </button>
    </div>
  );
};

export default Landing;
