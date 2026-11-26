import { useConnectionIssues, clearConnectionIssue } from "@/components/ConnectionNotice";
import { uploadAvatar } from "@/lib/avatarUpload";
import { authorizeAppleMusic, AppleMusicAuthError } from "@/lib/appleMusic";
import SpotifyPlaylistSync from "@/components/SpotifyPlaylistSync";
import PageTip, { resetTips } from "@/components/PageTip";
import { SETTINGS_TIPS } from "@/lib/tips";
import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import { SHORTCUT_INSTALL_URL, isAppleMobile } from "@/lib/shareLinks";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ChevronDown, LogOut, Radar, Share2 } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import TaglineSpace from "@/components/TaglineSpace";
import AboutPlai from "@/components/AboutPlai";
import AdminPanel from "@/components/AdminPanel";
import DeveloperNotes from "@/components/DeveloperNotes";
import { MOODS, getMoodBySlug } from "@/lib/moods";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

interface NotifSettings {
  push_follows: boolean;
  push_reactions: boolean;
  push_saves: boolean;
  push_recommendations: boolean;
}

const platformOptions = [
  { value: "spotify", label: "Spotify" },
  { value: "apple_music", label: "Apple Music" },
  { value: "youtube_music", label: "YouTube Music" },
  { value: "tidal", label: "Tidal" },
  { value: "amazon_music", label: "Amazon Music" },
];

const APIKEY = SUPABASE_PUBLISHABLE_KEY;

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "night", label: "night", icon: "☾" },
  { value: "dawn", label: "dawn", icon: "☀︎" },
  { value: "system", label: "match my phone", icon: "◐" },
];

const SettingsPage = () => {
  const { user, loading, signOut, signInWithSpotify } = useAuth();
  const [connectionIssues, refreshConnectionIssues] = useConnectionIssues();

  // Apple Music accounts sign in with username + PIN only; offer Google as a backup way in
  const identities = (user?.identities || []).map((i) => i.provider);
  const needsBackupSignIn =
    !!user && !identities.includes("google") && !identities.includes("spotify") &&
    (!!user.email?.endsWith("@plai.device") || (user as { is_anonymous?: boolean }).is_anonymous === true);

  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/settings?linked=google` },
    });
    if (error) {
      toast.error(
        /manual linking/i.test(error.message)
          ? "Google backup isn't switched on yet — tell the PLAI owner"
          : "Couldn't link Google — try again",
      );
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked") === "google") {
      toast.success("Google linked — you can now also sign in with Google");
      window.history.replaceState(null, "", "/settings");
    }
    // "reconnect" from the feed notice lands here: jump to the music apps
    if (window.location.hash === "#connected-platforms") {
      setTimeout(() => document.getElementById("connected-platforms")?.scrollIntoView({ behavior: "smooth" }), 400);
    }
  }, []);
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { preferredPlatform, setPreferredPlatform } = usePlatform();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pin, setPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [statusSaved, setStatusSaved] = useState(false);
  const [profileColor, setProfileColor] = useState("#FF2D78");
  const [showAbout, setShowAbout] = useState(false);
  const [showDeveloperNotes, setShowDeveloperNotes] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [tidalConnected, setTidalConnected] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyPlaylist, setSpotifyPlaylist] = useState<{ name: string | null; syncedAt: string | null }>({ name: null, syncedAt: null });
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [appleConnected, setAppleConnected] = useState(false);
  const [syncSpotify, setSyncSpotify] = useState(true);
  const [syncYoutube, setSyncYoutube] = useState(true);
  const [syncTidal, setSyncTidal] = useState(true);
  const [syncApple, setSyncApple] = useState(true);
  const [appleLoading, setAppleLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotifSettings>({
    push_follows: true,
    push_reactions: true,
    push_saves: true,
    push_recommendations: true,
  });
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasRadarAccess, setHasRadarAccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("radar_access" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasRadarAccess(!!data));
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await (supabase.rpc("get_my_profile") as any).single();
      if (data) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setIsPublic((data as any).public !== false);
        setStatus((data as any).status || "");
        setProfileColor((data as any).profile_color || "#FF2D78");
        setTidalConnected(!!(data as any).tidal_access_token);
        setSpotifyConnected(!!((data as any).spotify_refresh_token || (data as any).spotify_access_token));
        setSpotifyPlaylist({
          name: (data as any).spotify_playlist_name || null,
          syncedAt: (data as any).spotify_playlist_synced_at || null,
        });
        setYoutubeConnected(!!(data as any).youtube_access_token);
        setAppleConnected(!!(data as any).apple_music_user_token);
        setSyncSpotify((data as any).sync_spotify !== false);
        setSyncYoutube((data as any).sync_youtube !== false);
        setSyncTidal((data as any).sync_tidal !== false);
        setSyncApple((data as any).sync_apple_music !== false);
        setAvatarUrl((data as any).avatar_url || "");
        setCurrentMood((data as any).current_mood || null);
      }
      // Load notification settings
      const { data: ns } = await (supabase
        .from("user_notification_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle() as any);
      if (ns) {
        setNotifSettings({
          push_follows: ns.push_follows,
          push_reactions: ns.push_reactions,
          push_saves: ns.push_saves,
          push_recommendations: ns.push_recommendations,
        });
      }
      setNotifLoaded(true);
    };
    load();
  }, [user]);

  const handleSaveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    setDisplayNameSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user.id);
    setDisplayNameSaving(false);
    if (error) {
      toast.error("couldn't save — try again");
    } else {
      toast.success("display name saved ✓");
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !username.trim()) return;
    setUsernameSaving(true);
    const slug = username.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const { error } = await supabase.from("profiles").update({ username: slug }).eq("id", user.id);
    setUsernameSaving(false);
    if (error) {
      toast.error("couldn't save — try again");
    } else {
      toast.success("username saved ✓");
    }
  };

  const handleSave = async (field: string, value: any) => {
    if (!user) return;
    setSaving(true);
    const update: any = {};
    if (field === "public") update.public = value;
    if (field === "status") update.status = value;
    if (field === "profile_color") update.profile_color = value;
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("couldn't save — try again");
    } else {
      toast.success("saved ✓");
    }
  };

  const handleSaveStatus = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("couldn't save — try again");
    } else {
      setStatusSaved(true);
      toast.success("saved ✓");
      setTimeout(() => setStatusSaved(false), 2000);
    }
  };

  // The PIN becomes this account's password for "sign in with username + PIN" (setup-apple-pin).
  // It's never stored in the profile.
  const handleSavePin = async () => {
    if (!user || !/^\d{6}$/.test(pin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    setPinSaving(true);
    const { error } = await supabase.functions.invoke("setup-apple-pin", { body: { pin } });
    setPinSaving(false);
    if (error) {
      let message = "couldn't save PIN — try again";
      try {
        const body = await (error as any).context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // keep the generic message
      }
      toast.error(message);
      return;
    }
    toast.success("PIN saved — use it with your username to sign in on another device");
    setPin("");
  };

  // Only accounts without Spotify/Google email sign-in use a PIN
  const usesPinLogin = !!user && (!user.email || user.email.endsWith("@plai.device") || (user as any).is_anonymous);

  const connectAppleMusic = async () => {
    if (!user) return;
    setAppleLoading(true);
    try {
      const userToken = await authorizeAppleMusic();

      // User is already signed in — store token against existing profile
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || APIKEY;

      const { error: upsertError } = await supabase
        .from("profiles")
        .update({ apple_music_user_token: userToken } as any)
        .eq("id", user.id);
      if (upsertError) throw new Error("Could not save Apple Music token");

      setAppleConnected(true);
      await clearConnectionIssue("apple-music");
      refreshConnectionIssues();
      toast.success("Apple Music connected — syncing…");

      supabase.functions.invoke("sync-apple-music-likes", { body: { user_id: user.id } })
        .then(({ data, error }) => {
          if (error || data?.error) {
            toast.error("sync failed — try disconnecting and reconnecting");
          } else {
            toast.success(`synced ${data?.count ?? 0} songs from Apple Music`);
          }
        });
    } catch (err: any) {
      if (err instanceof AppleMusicAuthError && err.reason === "cancelled") {
        toast("Apple Music sign-in cancelled");
      } else if (err instanceof AppleMusicAuthError && err.reason === "stuck") {
        toast.error("Apple's sign-in didn't come back. On iPhone, try connecting from Safari instead of the home-screen app.", { duration: 8000 });
      } else {
        toast.error(err?.message || "Could not connect Apple Music — please try again");
        console.error("Apple Music auth error:", err);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const connectTidal = async () => {
    try {
      if (!user?.id) {
        toast.error("Please sign in first");
        return;
      }
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
      localStorage.setItem("tidal_user_id", user.id);
      const verifyVerifier = localStorage.getItem("tidal_code_verifier");
      const verifyUserId = localStorage.getItem("tidal_user_id");
      if (!verifyVerifier || !verifyUserId) {
        toast.error("Could not save auth state — try again");
        return;
      }
      const { data: result } = await supabase.functions.invoke("tidal-auth-url", {
        body: { code_challenge: codeChallenge, redirect_uri: `${window.location.origin}/auth/tidal/callback` },
      });
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Could not start Tidal login");
      }
    } catch (err) {
      toast.error("Could not connect to Tidal");
    }
  };

  const disconnectTidal = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ tidal_access_token: null, tidal_refresh_token: null } as any)
      .eq("id", user.id);
    setTidalConnected(false);
    toast.success("Tidal disconnected");
  };

  const connectYouTube = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-auth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey:
            SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          redirect_uri: window.location.origin + "/auth/youtube/callback",
        }),
      });
      const result = await response.json();
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Could not connect to YouTube Music");
      }
    } catch {
      toast.error("Could not connect to YouTube Music");
    }
  };

  const disconnectYouTube = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ youtube_access_token: null, youtube_refresh_token: null } as any)
      .eq("id", user.id);
    setYoutubeConnected(false);
    toast.success("YouTube Music disconnected");
  };

  const handleSyncToggle = async (field: string, value: boolean) => {
    if (!user) return;
    await supabase.from("profiles").update({ [field]: value } as any).eq("id", user.id);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Settings" />

      {showAbout && <AboutPlai onClose={() => setShowAbout(false)} />}
      {showDeveloperNotes && <DeveloperNotes onClose={() => setShowDeveloperNotes(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <main className="mx-auto max-w-feed px-4 py-6 space-y-6">
        <PageTip id="settings" steps={SETTINGS_TIPS} />
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setShowAbout(true)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors text-left"
            style={{ touchAction: "manipulation" }}
          >
            about plai →
          </button>
          <button
            onClick={() => setShowDeveloperNotes(true)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors text-left"
            style={{ touchAction: "manipulation" }}
          >
            developer notes →
          </button>
        </div>

        {/* Display name — separate save handler */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">account</h3>
          <label className="mb-1.5 block text-sm font-medium text-foreground">display name</label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveDisplayName()}
              className="settings-field bg-card border-border"
            />
            <button
              onClick={handleSaveDisplayName}
              disabled={displayNameSaving}
              className="settings-save rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {displayNameSaving ? "saving..." : "save"}
            </button>
          </div>
        </div>

        {/* Username — separate save handler */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">username</label>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
              className="settings-field bg-card border-border"
            />
            <button
              onClick={handleSaveUsername}
              disabled={usernameSaving}
              className="settings-save rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {usernameSaving ? "saving..." : "save"}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">letters, numbers, . _ - only</span>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">your profile</h3>
          <label className="mb-1.5 block text-sm font-medium text-foreground">profile photo</label>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-primary/20 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setAvatarUrl("")} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                  {(displayName || username || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
            <label
              htmlFor="settings-avatar-file"
              className={`settings-save cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 ${avatarSaving ? "pointer-events-none opacity-50" : ""}`}
              style={{ touchAction: "manipulation" }}
            >
              {avatarSaving ? "uploading..." : avatarUrl ? "change photo" : "add photo"}
            </label>
            <input
              id="settings-avatar-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!user || !file) return;
                setAvatarSaving(true);
                try {
                  setAvatarUrl(await uploadAvatar(user.id, file));
                  toast.success("photo saved ✓");
                } catch (err: any) {
                  toast.error(err?.message || "couldn't save — try again");
                } finally {
                  setAvatarSaving(false);
                }
              }}
            />
          </div>
        </div>

        {/* status sits under "your profile" with the photo */}
        <div className="-mt-2">
          <label className="mb-1.5 block text-sm font-medium text-foreground">status</label>
          <div className="flex gap-2">
            <Input
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveStatus()}
              placeholder="on rotation"
              className="settings-field bg-card border-border"
              maxLength={80}
            />
            <button
              onClick={handleSaveStatus}
              disabled={saving}
              className="settings-save rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {saving ? "saving..." : statusSaved ? "saved ✓" : "save"}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {status.length}/80 · shown on your profile
          </span>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">appearance</h3>
          <div role="radiogroup" aria-label="appearance" className="grid grid-cols-3 gap-2">
            {APPEARANCE_OPTIONS.map((opt) => {
              const selected = themePreference === opt.value;
              return (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setThemePreference(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition-colors duration-150 ${
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ touchAction: "manipulation" }}
                >
                  <span className="text-base leading-none" aria-hidden="true">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {themePreference === "system"
              ? "follows your phone — dawn in light mode, night in dark mode"
              : themePreference === "dawn"
                ? "the same sky at first light"
                : "the night sky"}
          </p>
        </div>

        {needsBackupSignIn && (
          <div className="border-t border-border pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">backup sign-in</h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground mb-3">
              You sign in with your username and PIN. Link Google too, so you can still get in on a new phone or if you
              forget your PIN.
            </p>
            <button
              onClick={linkGoogle}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
              style={{ touchAction: "manipulation" }}
            >
              link Google
            </button>
          </div>
        )}

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">tips</h3>
          <p className="text-[11px] text-muted-foreground mb-3">the short guides at the top of each page</p>
          <button
            onClick={() => {
              resetTips();
              toast("tips will show again on each page");
            }}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
            style={{ touchAction: "manipulation" }}
          >
            show tips again
          </button>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">moon appearance</h3>
          <label className="mb-1.5 block text-sm font-medium text-foreground">moon colour</label>
          <p className="text-[10px] text-muted-foreground mb-2">
            sets the colour of your moon dot in your friends' libraries — only visible to those you follow
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={profileColor}
              onChange={(e) => setProfileColor(e.target.value)}
              className="h-8 w-8 rounded-full border border-border cursor-pointer bg-transparent"
            />
            <span className="text-xs text-muted-foreground">{profileColor}</span>
            <button
              onClick={() => handleSave("profile_color", profileColor)}
              className="settings-save rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
              style={{ touchAction: "manipulation" }}
            >
              save
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">current mood</h3>
          <p className="text-[10px] text-muted-foreground mb-3">
            sets your vibe — shown as an emoji next to your name in friends' libraries. Only visible to those you follow.
          </p>
          {currentMood ? (
            <p className="text-sm text-foreground mb-3">
              {getMoodBySlug(currentMood)?.emoji} {getMoodBySlug(currentMood)?.label}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">not set</p>
          )}
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.slug}
                onClick={async () => {
                  if (!user) return;
                  const newMood = currentMood === m.slug ? null : m.slug;
                  setCurrentMood(newMood);
                  await supabase
                    .from("profiles")
                    .update({ current_mood: newMood, mood_set_at: newMood ? new Date().toISOString() : null } as any)
                    .eq("id", user.id);
                  toast.success(newMood ? `mood set to ${m.emoji} ${m.label}` : "mood cleared");
                }}
                style={{ touchAction: "manipulation" }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  currentMood === m.slug
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
            preferred platform
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">track links and play buttons open in this app</p>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreferredPlatform(p.value)}
                style={{ touchAction: "manipulation" }}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
                  preferredPlatform === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">share from any music app</h3>
          {isAppleMobile() ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                add "Share with PLAI" to your iPhone share sheet — share a song from Spotify, Apple Music, Tidal or YouTube Music and get a PLAI link that plays everywhere
              </p>
              <a
                href={SHORTCUT_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                style={{ touchAction: "manipulation" }}
              >
                <Share2 className="h-4 w-4" />
                add to iPhone share sheet
              </a>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              add PLAI to your home screen and it appears in your phone's share menu — share a song from any music app to get a PLAI link that plays everywhere
            </p>
          )}
        </div>

        <div id="connected-platforms" className="border-t border-border pt-6 scroll-mt-20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
            connected platforms
          </h3>
          <div className="space-y-4">

            {/* Spotify — connected account, or a public playlist for people Spotify won't let connect */}
            <div>
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${spotifyConnected || spotifyPlaylist.name ? "bg-green-500" : "bg-muted"}`} />
                <span className="text-sm text-foreground">Spotify</span>
                {spotifyConnected && connectionIssues.includes("spotify") ? (
                  <button onClick={() => signInWithSpotify()} className="ml-auto text-xs font-medium text-primary">
                    expired · reconnect
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {spotifyConnected ? "connected" : spotifyPlaylist.name ? "via playlist" : "not connected"}
                  </span>
                )}
              </div>
              {!spotifyConnected && (
                <SpotifyPlaylistSync
                  playlistName={spotifyPlaylist.name}
                  syncedAt={spotifyPlaylist.syncedAt}
                  onChange={setSpotifyPlaylist}
                />
              )}
              {spotifyConnected && (
              <div className="ml-5 mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">sync collection</span>
                <button
                  onClick={() => { setSyncSpotify(!syncSpotify); handleSyncToggle("sync_spotify", !syncSpotify); }}
                  style={{ touchAction: "manipulation" }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${syncSpotify ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150 ${syncSpotify ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              )}
            </div>

            {/* Tidal */}
            <div>
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${tidalConnected ? "bg-green-500" : "bg-muted"}`} />
                <span className="text-sm text-foreground">Tidal</span>
                {tidalConnected ? (
                  <div className="ml-auto flex items-center gap-2">
                    {connectionIssues.includes("tidal") ? (
                      <button onClick={connectTidal} className="text-xs font-medium text-primary">expired · reconnect</button>
                    ) : (
                      <span className="text-xs text-muted-foreground">connected</span>
                    )}
                    <button onClick={disconnectTidal} className="text-[10px] text-destructive hover:underline">
                      disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={connectTidal} className="ml-auto text-xs text-primary hover:underline">
                    connect →
                  </button>
                )}
              </div>
              {tidalConnected && (
                <div className="ml-5 mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">sync collection</span>
                  <button
                    onClick={() => { setSyncTidal(!syncTidal); handleSyncToggle("sync_tidal", !syncTidal); }}
                    style={{ touchAction: "manipulation" }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${syncTidal ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150 ${syncTidal ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Apple Music */}
            <div>
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${appleConnected ? "bg-green-500" : "bg-muted"}`} />
                <span className="text-sm text-foreground">Apple Music</span>
                {appleConnected ? (
                  <div className="ml-auto flex items-center gap-2">
                    {connectionIssues.includes("apple-music") ? (
                      <button onClick={connectAppleMusic} className="text-xs font-medium text-primary">expired · reconnect</button>
                    ) : (
                      <span className="text-xs text-muted-foreground">connected</span>
                    )}
                    <button
                      onClick={async () => {
                        if (!user) return;
                        await supabase.from("profiles").update({ apple_music_user_token: null } as any).eq("id", user.id);
                        await (supabase.rpc as any)("delete_apple_music_likes", { p_user_id: user.id });
                        setAppleConnected(false);
                        toast.success("Apple Music disconnected");
                      }}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectAppleMusic}
                    disabled={appleLoading}
                    className="ml-auto text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {appleLoading ? "connecting…" : "connect →"}
                  </button>
                )}
              </div>
              {appleConnected && (
                <div className="ml-5 mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">sync collection</span>
                  <button
                    onClick={() => { setSyncApple(!syncApple); handleSyncToggle("sync_apple_music", !syncApple); }}
                    style={{ touchAction: "manipulation" }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${syncApple ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150 ${syncApple ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
              )}
            </div>

            {/* YouTube Music */}
            <div>
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${youtubeConnected ? "bg-green-500" : "bg-muted"}`} />
                <span className="text-sm text-foreground">YouTube Music</span>
                {youtubeConnected ? (
                  <div className="ml-auto flex items-center gap-2">
                    {connectionIssues.includes("youtube") ? (
                      <button onClick={connectYouTube} className="text-xs font-medium text-primary">expired · reconnect</button>
                    ) : (
                      <span className="text-xs text-muted-foreground">connected</span>
                    )}
                    <button onClick={disconnectYouTube} className="text-[10px] text-destructive hover:underline">
                      disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={connectYouTube} className="ml-auto text-xs text-primary hover:underline">
                    connect →
                  </button>
                )}
              </div>
              {youtubeConnected && (
                <div className="ml-5 mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">sync collection</span>
                  <button
                    onClick={() => { setSyncYoutube(!syncYoutube); handleSyncToggle("sync_youtube", !syncYoutube); }}
                    style={{ touchAction: "manipulation" }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${syncYoutube ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150 ${syncYoutube ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Tools */}
        {hasRadarAccess && (
          <div className="border-t border-border pt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">tools</p>
            <Link
              to="/radar"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Radar className="h-4 w-4 text-primary" />
              PLAI Radar
            </Link>
          </div>
        )}

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">privacy</h3>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">public profile</p>
              <p className="text-xs text-muted-foreground">visible in discover and search</p>
            </div>
            <button
              onClick={() => {
                setIsPublic(!isPublic);
                handleSave("public", !isPublic);
              }}
              style={{ touchAction: "manipulation" }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ${isPublic ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${isPublic ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </label>
          {usesPinLogin && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">quick login PIN</h4>
            <p className="text-xs text-muted-foreground mb-2">set a 6-digit PIN to sign in with your username on another device</p>
            <div className="flex gap-2">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="settings-field bg-card border-border w-32 text-center tracking-[0.3em]"
              />
              <button
                onClick={handleSavePin}
                disabled={pinSaving || pin.length !== 6}
                className="settings-save rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
                style={{ touchAction: "manipulation" }}
              >
                {pinSaving ? "saving..." : "save"}
              </button>
            </div>
          </div>
          )}
        </div>

        <div className="border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">push notifications</h3>
              <p className="text-[10px] text-muted-foreground mt-1">choose which notifications you'd like to receive</p>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-foreground transition-transform duration-200 ${notifOpen ? "rotate-180" : ""}`}
            />
          </button>
          {notifOpen && (
            <div className="mt-4 space-y-4">
              {([
                { key: "push_follows" as const, label: "new followers", desc: "when someone follows you" },
                { key: "push_reactions" as const, label: "reactions", desc: "when someone reacts to your song" },
                { key: "push_saves" as const, label: "saves", desc: "when someone saves your song" },
                { key: "push_recommendations" as const, label: "recommendations", desc: "when someone recommends you a song" },
              ]).map((item) => (
                <label key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const next = { ...notifSettings, [item.key]: !notifSettings[item.key] };
                      setNotifSettings(next);
                      const { error } = await (supabase
                        .from("user_notification_settings" as any)
                        .upsert({ user_id: user.id, ...next } as any, { onConflict: "user_id" }) as any);
                      if (error) toast.error("couldn't save — try again");
                    }}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ${
                      notifSettings[item.key]
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
                        notifSettings[item.key] ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-12 pb-6">
          <TaglineSpace />
          <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
            v0.1 beta · from old provençal — "it pleases me"
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <button
            onClick={signOut}
            style={{ touchAction: "manipulation" }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10"
          >
            <LogOut className="h-4 w-4" />
            sign out
          </button>
        </div>

        <div className="pt-2 pb-6 text-center">
          <button
            onClick={() => setShowAdmin(true)}
            style={{ touchAction: "manipulation" }}
            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            admin →
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default SettingsPage;
