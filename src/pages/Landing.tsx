import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";
import { getRandomTagline } from "@/lib/taglines";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

const Landing = () => {
  const { user, loading, signInWithSpotify } = useAuth();
  const navigate = useNavigate();
  const [tagline, setTagline] = useState(() => getRandomTagline());
  const [fade, setFade] = useState(true);
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

  const handlePinLogin = async () => {
    if (!pinUsername || pinValue.length !== 4) {
      toast.error("enter your username and 4-digit PIN");
      return;
    }
    setPinLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, login_pin, display_name, username")
        .eq("username", pinUsername.toLowerCase())
        .single();

      if (error || !profile) {
        toast.error("username not found");
        setPinLoading(false);
        return;
      }
      if (!profile.login_pin) {
        toast.error("no PIN set — connect Spotify first, then set a PIN in settings");
        setPinLoading(false);
        return;
      }
      if (profile.login_pin !== pinValue) {
        const { data: verified } = await (supabase.rpc as any)("verify_login_pin", {
          p_email: "",
          p_pin: pinValue,
        });
        toast.error("incorrect PIN");
        setPinLoading(false);
        return;
      }

      toast.success(`welcome back, ${profile.display_name || profile.username}`);
      navigate(`/profile/${profile.username || profile.id}`);
    } catch {
      toast.error("PIN login failed");
    }
    setPinLoading(false);
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

      // localStorage survives cross-origin redirects, sessionStorage does not
      localStorage.setItem("tidal_code_verifier", codeVerifier);
      // No user session on landing page — TidalCallback will get session after redirect
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
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            continue with Spotify
          </button>

          <button
            onClick={connectTidal}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4L20.02 3.992l4.004 4.004-4.004 4.004-4.004-4.004-4.004 4.004z" />
            </svg>
            continue with Tidal
          </button>

          <button
            onClick={() => toast("Apple Music coming soon")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
          >
            continue with Apple Music
          </button>

          <button
            onClick={() => toast("YouTube Music coming soon")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
          >
            continue with YouTube Music
          </button>
        </div>

        <div className="w-full">
          {!showPinLogin ? (
            <button
              onClick={() => setShowPinLogin(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
            >
              quick view — sign in with username + PIN
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2">enter your username and 4-digit PIN</p>
              <Input
                type="text"
                value={pinUsername}
                onChange={(e) => setPinUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                placeholder="username"
                className="bg-background border-border text-sm"
              />
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="bg-background border-border text-sm text-center tracking-[0.3em] w-24 mx-auto"
              />
              <button
                onClick={handlePinLogin}
                disabled={pinLoading}
                className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              >
                {pinLoading ? "checking..." : "sign in"}
              </button>
              <p className="text-[10px] text-muted-dim text-center">
                viewing as guest — connect Spotify for full access
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground/40">we only read your likes. nothing else.</p>
      </div>

      {/* iOS Safari install prompt */}
      <IOSInstallPrompt />
      {/* Android install prompt */}
      <AndroidInstallPrompt />
    </div>
  );
};

const IOSInstallPrompt = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const isIos = /iPhone|iPad/.test(navigator.userAgent);
    const isStandalone = (navigator as any).standalone === true;
    const dismissed = localStorage.getItem("plai_pwa_dismissed");
    if (isIos && !isStandalone && !dismissed) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between" style={{ background: "#0F1520", borderTop: "0.5px solid #1a2535", padding: "10px 16px" }}>
      <p style={{ fontSize: 11, color: "#4a6a8a" }}>tap Share → "Add to Home Screen" to install PLAI</p>
      <button onClick={() => { localStorage.setItem("plai_pwa_dismissed", "1"); setShow(false); }} style={{ fontSize: 11, color: "#4a6a8a", marginLeft: 12 }}>×</button>
    </div>
  );
};

const AndroidInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setVisible(true); timerRef.current = setTimeout(() => setVisible(false), 8000); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => { window.removeEventListener("beforeinstallprompt", handler); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!visible || !deferredPrompt) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <button onClick={() => { deferredPrompt.prompt(); setVisible(false); }} className="rounded-full px-5 py-2 text-xs font-medium text-primary-foreground" style={{ background: "#FF2D78" }}>
        add PLAI to your home screen →
      </button>
    </div>
  );
};

export default Landing;
