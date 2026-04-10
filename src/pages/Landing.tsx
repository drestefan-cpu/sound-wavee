import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";
import { getRandomTagline } from "@/lib/taglines";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const { user, loading, signInWithSpotify } = useAuth();
  const navigate = useNavigate();
  const [tagline, setTagline] = useState("i love your taste");
  const [fade, setFade] = useState(true);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);

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
            onClick={connectTidal}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
            style={{ touchAction: "manipulation" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4L20.02 3.992l4.004 4.004-4.004 4.004-4.004-4.004-4.004 4.004z" />
            </svg>
            continue with Tidal
          </button>

          <button
            onClick={() => toast("Apple Music coming soon")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
            style={{ touchAction: "manipulation" }}
          >
            continue with Apple Music
          </button>
        </div>

        <p className="text-xs text-muted-foreground/40">Come have a good time </p>
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
