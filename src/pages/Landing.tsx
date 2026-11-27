import { authorizeAppleMusic, AppleMusicAuthError, isIOS, isStandaloneApp } from "@/lib/appleMusic";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";
import { getRandomTagline } from "@/lib/taglines";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { uploadAvatar } from "@/lib/avatarUpload";
import { pendingInvite } from "@/lib/invite";
import { suggestUsername } from "@/lib/username";
import { Camera } from "lucide-react";

const APIKEY = SUPABASE_PUBLISHABLE_KEY;

const Landing = () => {
  const { user, loading, signInWithSpotify } = useAuth();
  const navigate = useNavigate();
  const [tagline, setTagline] = useState("i love your taste");
  const [fade, setFade] = useState(true);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showAppleOnboarding, setShowAppleOnboarding] = useState(false);
  // Apple's sign-in window can get stuck inside the home-screen app: after a few seconds offer a way out
  const [appleSlow, setAppleSlow] = useState(false);
  const [appleHelp, setAppleHelp] = useState(false);
  // After creating an Apple account in Safari: explain signing in on the home-screen app with the PIN
  const [appleDone, setAppleDone] = useState<string | null>(null);
  const [anonUserId, setAnonUserId] = useState<string | null>(null);
  const [onboardingUsername, setOnboardingUsername] = useState("");
  const [onboardingPin, setOnboardingPin] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [pinUsername, setPinUsername] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  // Apple sign-up: the new account is signed in before it has a username — don't jump to the feed yet
  const holdForSignup = useRef(false);
  // Anonymous accounts are checked for a missing username before deciding where to go
  const [signupCheckedFor, setSignupCheckedFor] = useState<string | null>(null);
  // Step 2 of Apple sign-up: optional name + photo (Apple doesn't share either)
  const [stepName, setStepName] = useState("");
  const [stepAvatar, setStepAvatar] = useState("");
  const [stepUploading, setStepUploading] = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [signupPlatform, setSignupPlatform] = useState<"apple" | "tidal">("apple");
  const photoInput = useRef<HTMLInputElement>(null);

  // Signed in with Apple Music earlier but never picked a username (closed the app halfway):
  // pick up the sign-up where it stopped instead of dropping them in the feed nameless
  useEffect(() => {
    if (!user || !user.is_anonymous || holdForSignup.current) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.username) {
          holdForSignup.current = true;
          setAnonUserId(user.id);
          // Coming from Tidal sign-in: their Tidal name is filled in
          try {
            const info = JSON.parse(sessionStorage.getItem("plai-signup") || "null");
            if (info?.platform) setSignupPlatform(info.platform);
            if (info?.name) {
              setStepName(info.name);
              setOnboardingUsername(suggestUsername(info.name));
            }
          } catch {}
          setShowAppleOnboarding(true);
        }
        setSignupCheckedFor(user.id);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
        scopes: "https://www.googleapis.com/auth/youtube.readonly",
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
      // 1–4. Apple's sign-in (shared helper: loads MusicKit, stops waiting if the window gets stuck)
      setAppleSlow(false);
      const slowTimer = setTimeout(() => setAppleSlow(true), 8000);
      let userToken: string;
      try {
        userToken = await authorizeAppleMusic();
      } finally {
        clearTimeout(slowTimer);
      }

      // 5. Get existing session or create anonymous account for standalone Apple Music users
      let isAnonymousFlow = false;
      let { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;

      if (!userId) {
        isAnonymousFlow = true;
        holdForSignup.current = true;
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
        .update({ apple_music_user_token: userToken } as any)
        .eq("id", userId);
      if (upsertError) throw new Error("Could not save Apple Music token");

      // Apple Music listeners play songs on Apple Music (unless they've picked another app)
      if (isAnonymousFlow) {
        await supabase.from("profiles").update({ preferred_platform: "apple_music" } as any).eq("id", userId);
        try {
          localStorage.setItem("plai-platform", "apple_music");
        } catch {}
      }

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
        setOnboardingUsername(""); setUsernameEdited(false); setStepName("");
        setOnboardingPin("");
        setShowAppleOnboarding(true);
      } else {
        toast.success("Apple Music connected!");
        navigate("/feed");
      }
    } catch (err: any) {
      if (err instanceof AppleMusicAuthError && err.reason === "cancelled") {
        toast("Apple Music sign-in cancelled");
      } else if (err instanceof AppleMusicAuthError && err.reason === "stuck") {
        setAppleHelp(true);
      } else {
        toast.error(err?.message || "Could not connect Apple Music — please try again");
        console.error("Apple Music auth error:", err);
      }
      // Nothing to finish if the account never got created
      if (!(await supabase.auth.getSession()).data.session) holdForSignup.current = false;
    } finally {
      setAppleLoading(false);
      setAppleSlow(false);
    }
  };

  const handleAppleOnboarding = async () => {
    const cleanUsername = onboardingUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!cleanUsername || cleanUsername.length < 2) {
      toast.error("username must be at least 2 characters");
      return;
    }
    if (!/^\d{6}$/.test(onboardingPin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    if (!anonUserId) return;

    setOnboardingLoading(true);
    try {
      const { error: usernameError } = await supabase
        .from("profiles")
        .update({ username: cleanUsername, display_name: stepName.trim() || cleanUsername } as any)
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
      if (pinError) {
        let reason = "";
        try {
          reason = (await (pinError as { context?: Response }).context?.json())?.error || "";
        } catch {}
        throw new Error(reason || "Couldn't save your PIN — please try again");
      }

      setShowAppleOnboarding(false);
      try {
        sessionStorage.removeItem("plai-signup");
      } catch {}
      finishSignup(cleanUsername);
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error(err?.message || "Couldn't set up your account — please try again");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const finishSignup = (username: string) => {
    // On iPhone in Safari, the home-screen app keeps its own sign-in: tell them to use the PIN there
    if (isIOS() && !isStandaloneApp()) {
      setAppleDone(username);
      return;
    }
    holdForSignup.current = false;
    toast.success("welcome to PLAI!");
    navigate("/feed");
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file || !anonUserId) return;
    setStepUploading(true);
    try {
      setStepAvatar(await uploadAvatar(anonUserId, file));
    } catch (err: any) {
      toast.error(err?.message || "couldn't upload the photo — try again");
    } finally {
      setStepUploading(false);
    }
  };

  const handlePinLogin = async () => {
    const cleanUsername = pinUsername.toLowerCase().trim();
    if (!cleanUsername || !/^(\d{4}|\d{6})$/.test(pinValue)) return; // 4 = older PINs, 6 = new

    setPinLoading(true);
    try {
      // Checked on the server (works for every account type; locks after 5 wrong tries)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: APIKEY },
        body: JSON.stringify({ username: cleanUsername, pin: pinValue }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.access_token) {
        toast.error(result.error || "sign in failed — try again");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) {
        toast.error("sign in failed — try again");
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

  const checkingSignup = !!user?.is_anonymous && !holdForSignup.current && signupCheckedFor !== user.id;
  if (loading || checkingSignup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && !holdForSignup.current && !showAppleOnboarding && !appleDone) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Starfield />

      {/* Full screen install overlay — iOS only */}
      {showInstallOverlay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "hsl(var(--background) / 0.95)",
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
              background: "hsl(var(--card))",
              borderTop: "0.5px solid hsl(var(--border))",
              borderRadius: "24px 24px 0 0",
              padding: "12px 24px 52px",
              textAlign: "center",
            }}
          >
            <div style={{ width: 36, height: 4, background: "hsl(var(--secondary))", borderRadius: 2, margin: "0 auto 28px" }} />
            <img
              src="/plai-icon.png"
              alt="PLAI"
              style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 16 }}
            />
            <p style={{ fontSize: 22, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 8 }}>
              save PLAI to your home screen
            </p>
            <p
              style={{
                fontSize: 13,
                color: "hsl(var(--muted-foreground))",
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
                background: "hsl(var(--background))",
                border: "0.5px solid hsl(var(--border))",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 28,
                textAlign: "left",
              }}
            >
              {[
                <span>
                  tap the <span style={{ color: "hsl(var(--primary))", fontWeight: 500 }}>Share</span> button{" "}
                  <svg
                    style={{ display: "inline", verticalAlign: "middle", marginBottom: 2 }}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="hsl(var(--primary))"
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
                  scroll down and tap <span style={{ color: "hsl(var(--primary))", fontWeight: 500 }}>"Add to Home Screen"</span>
                </span>,
                <span>
                  tap <span style={{ color: "hsl(var(--primary))", fontWeight: 500 }}>Add</span> — then open PLAI from your home
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
                      background: "hsl(var(--primary))",
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
                  <p style={{ fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={dismissInstall}
              style={{
                width: "100%",
                padding: "15px",
                background: "hsl(var(--primary))",
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
              style={{ background: "none", border: "none", color: "hsl(var(--muted-foreground))", fontSize: 11, cursor: "pointer" }}
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

        {appleDone ? (
          /* ── Apple account created in Safari: the home-screen app signs in with the PIN ── */
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <p className="text-lg font-medium text-foreground">you're in, @{appleDone} 🎉</p>
            <div className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm leading-relaxed text-muted-foreground">
              <p className="mb-2 text-foreground">one last step on iPhone:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>tap <span className="text-primary">Share</span> → <span className="text-primary">Add to Home Screen</span></li>
                <li>open PLAI from your home screen</li>
                <li>tap <span className="text-primary">sign in with your PIN</span> and use <span className="text-foreground">@{appleDone}</span> + your PIN</li>
              </ol>
              <p className="mt-2 text-xs">(your iPhone keeps the home-screen app separate from Safari, so it needs its own sign-in)</p>
            </div>
            <button
              onClick={() => {
                holdForSignup.current = false;
                navigate("/feed");
              }}
              className="w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground"
              style={{ touchAction: "manipulation" }}
            >
              continue in Safari for now →
            </button>
          </div>
        ) : showAppleOnboarding ? (
          /* ── Apple Music sign-up: photo, name, username and PIN on one screen ── */
          <div className="flex w-full flex-col gap-4">
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              {signupPlatform === "tidal" ? (
                <>Tidal connected ✓<br />now set up your PLAI profile</>
              ) : (
                <>Apple Music doesn't share your name or photo,<br />so set up your profile here</>
              )}
            </p>
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={stepUploading}
              aria-label="choose a profile photo"
              className="group relative mx-auto h-20 w-20 rounded-full"
              style={{ touchAction: "manipulation" }}
            >
              <span className="block h-full w-full overflow-hidden rounded-full border border-border bg-card transition-colors group-hover:border-primary">
                {stepAvatar ? (
                  <img src={stepAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                    {(stepName.trim() || onboardingUsername || "+")[0].toUpperCase()}
                  </span>
                )}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                {stepUploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-left text-xs text-muted-foreground">
                <span className="text-foreground">name</span> · what friends see on your songs
              </span>
              <input
                id="signup-name"
                value={stepName}
                onChange={(e) => {
                  const name = e.target.value.slice(0, 40);
                  setStepName(name);
                  // Suggest a username from the name until they type their own
                  if (!usernameEdited) setOnboardingUsername(suggestUsername(name));
                }}
                placeholder="e.g. André Delaney"
                autoComplete="name"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                style={{ touchAction: "manipulation" }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-left text-xs text-muted-foreground">
                <span className="text-foreground">username</span> · for your profile link and signing in
              </span>
              <span className="flex items-center rounded-2xl border border-border bg-card px-4 transition-colors focus-within:border-primary">
                <span className="text-sm text-muted-foreground">@</span>
                <input
                  id="signup-username"
                  value={onboardingUsername}
                  onChange={(e) => {
                    setUsernameEdited(true);
                    setOnboardingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""));
                  }}
                  placeholder="andre"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="min-w-0 flex-1 bg-transparent py-3.5 pl-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ touchAction: "manipulation" }}
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-left text-xs text-muted-foreground">
                <span className="text-foreground">6-digit PIN</span> · to sign back in on any device
              </span>
              <input
                id="signup-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={onboardingPin}
                onChange={(e) => setOnboardingPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-center text-sm tracking-[0.5em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                style={{ touchAction: "manipulation" }}
              />
            </label>

            <button
              onClick={handleAppleOnboarding}
              disabled={onboardingLoading || stepUploading || onboardingUsername.length < 2 || onboardingPin.length !== 6}
              className="mt-1 flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-60"
              style={{ touchAction: "manipulation" }}
            >
              {onboardingLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : "create my PLAI →"}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                holdForSignup.current = false;
                try {
                  sessionStorage.removeItem("plai-signup");
                } catch {}
                setShowAppleOnboarding(false);
                setAnonUserId(null);
                setOnboardingUsername("");
                setOnboardingPin("");
                setStepName("");
                setStepAvatar("");
                setUsernameEdited(false);
              }}
              className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              style={{ touchAction: "manipulation" }}
            >
              ← use a different music app
            </button>
          </div>
        ) : showPinLogin ? (
          /* ── PIN login ── */
          <div className="flex w-full flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">sign in with your username and PIN</p>
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
              maxLength={6}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="PIN"
              className="w-full rounded-2xl bg-card border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-center tracking-[0.5em]"
              style={{ touchAction: "manipulation" }}
            />
            <button
              onClick={handlePinLogin}
              disabled={pinLoading || !pinUsername.trim() || (pinValue.length !== 4 && pinValue.length !== 6)}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-60"
              style={{ touchAction: "manipulation" }}
            >
              {pinLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : "sign in →"}
            </button>
            <button
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/feed` },
                });
                if (error) toast.error("Could not connect to Google");
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              style={{ touchAction: "manipulation" }}
            >
              linked Google to your account? <span className="text-primary">sign in with Google</span>
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
            {pendingInvite() && (
              <p className="-mb-2 text-center text-xs text-muted-foreground">
                invited by <span className="font-medium text-primary">@{pendingInvite()}</span> · pick your music app
              </p>
            )}
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
              {appleLoading && appleSlow && (
                <button
                  onClick={() => setAppleHelp(true)}
                  className="-mt-1 text-xs text-primary"
                  style={{ touchAction: "manipulation" }}
                >
                  stuck? here's another way →
                </button>
              )}
              {appleHelp && <AppleHelp onClose={() => setAppleHelp(false)} />}

              <button
                onClick={connectTidal}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
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
              onClick={() => { setPinUsername(""); setPinValue(""); setShowPinLogin(true); }}
              className="mt-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              style={{ touchAction: "manipulation" }}
            >
              set a PIN? <span className="font-medium text-primary">sign in with your username + PIN</span>
            </button>
            <footer className="mt-2 flex flex-col items-center gap-1.5 text-center">
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground/70">
                PLAI shows you the songs your friends love on Spotify, Apple Music, Tidal and YouTube Music.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                <a href="/privacy" className="hover:text-foreground">privacy</a> ·{" "}
                <a href="/terms" className="hover:text-foreground">terms</a>
              </p>
            </footer>
          </>
        )}
      </div>

      <AndroidInstallPrompt />
    </div>
  );
};

/** When Apple's sign-in window gets stuck (mostly inside the iPhone home-screen app) */
const AppleHelp = ({ onClose }: { onClose: () => void }) => {
  const inHomeScreenApp = isStandaloneApp();
  const link = "https://plai.delaneyprojects.xyz";
  return (
    <div className="w-full rounded-2xl border border-primary/30 bg-card p-4 text-left text-sm leading-relaxed text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">Apple's sign-in didn't come back</p>
      {inHomeScreenApp ? (
        <ol className="list-decimal space-y-1 pl-5">
          <li>open <span className="text-foreground">{link.replace("https://", "")}</span> in <span className="text-primary">Safari</span></li>
          <li>tap <span className="text-primary">continue with Apple Music</span> and set a username + PIN</li>
          <li>come back here and tap <span className="text-primary">sign in with your PIN</span></li>
        </ol>
      ) : (
        <p>Close any Apple sign-in tabs, make sure pop-ups aren't blocked for this site, and try again.</p>
      )}
      <div className="mt-3 flex items-center gap-4">
        {inHomeScreenApp && (
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .then(() => toast("link copied — paste it in Safari"))
                .catch(() => {})
            }
            className="text-xs font-medium text-primary"
          >
            copy link
          </button>
        )}
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          close
        </button>
      </div>
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
        style={{ background: "hsl(var(--primary))", touchAction: "manipulation" }}
      >
        add PLAI to your home screen →
      </button>
    </div>
  );
};

export default Landing;
