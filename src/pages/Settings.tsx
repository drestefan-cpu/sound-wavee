import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import TaglineSpace from "@/components/TaglineSpace";
import AboutPlai from "@/components/AboutPlai";
import AdminPanel from "@/components/AdminPanel";
import { MOODS, getMoodBySlug } from "@/lib/moods";

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
];

const SettingsPage = () => {
  const { user, loading, signOut } = useAuth();
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
  const [profileColor, setProfileColor] = useState("#080B12");
  const [showAbout, setShowAbout] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [tidalConnected, setTidalConnected] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setIsPublic((data as any).public !== false);
        setStatus((data as any).status || "");
        setProfileColor((data as any).profile_color || "#080B12");
        setTidalConnected(!!(data as any).tidal_access_token);
        setYoutubeConnected(!!(data as any).youtube_access_token);
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

  const handleSavePin = async () => {
    if (!user || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    setPinSaving(true);
    const { error } = await (supabase.rpc as any)("set_login_pin", {
      p_user_id: user.id,
      p_pin: pin,
    });
    if (error) {
      const { error: e2 } = await supabase
        .from("profiles")
        .update({ login_pin: pin } as any)
        .eq("id", user.id);
      setPinSaving(false);
      if (e2) toast.error("Failed to save PIN");
      else {
        toast.success("PIN saved");
        setPin("");
      }
    } else {
      setPinSaving(false);
      toast.success("PIN saved");
      setPin("");
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
      const response = await fetch("https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/youtube-auth-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE",
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

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Settings" />

      {showAbout && <AboutPlai onClose={() => setShowAbout(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <main className="mx-auto max-w-feed px-4 py-6 space-y-6">
        <button
          onClick={() => setShowAbout(true)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
          style={{ touchAction: "manipulation" }}
        >
          about plai →
        </button>

        {/* Display name — separate save handler */}
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">display name</label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveDisplayName()}
              className="bg-card border-border"
            />
            <button
              onClick={handleSaveDisplayName}
              disabled={displayNameSaving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {displayNameSaving ? "..." : "save"}
            </button>
          </div>
        </div>

        {/* Username — separate save handler */}
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">username</label>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
              className="bg-card border-border"
            />
            <button
              onClick={handleSaveUsername}
              disabled={usernameSaving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {usernameSaving ? "..." : "save"}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">letters, numbers, . _ - only</span>
        </div>

        <div className="border-t border-border pt-6">
          <label className="mb-1.5 block text-sm text-muted-foreground">profile photo</label>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setAvatarUrl("")} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                  {displayName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="paste an image URL"
              className="bg-card border-border"
            />
          </div>
          <button
            onClick={async () => {
              if (!user || !avatarUrl.trim()) return;
              setAvatarSaving(true);
              const { error } = await supabase
                .from("profiles")
                .update({ avatar_url: avatarUrl.trim() } as any)
                .eq("id", user.id);
              setAvatarSaving(false);
              if (error) toast.error("couldn't save — try again");
              else toast.success("photo saved ✓");
            }}
            disabled={avatarSaving}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
            style={{ touchAction: "manipulation" }}
          >
            {avatarSaving ? "..." : "save"}
          </button>
        </div>

        <div className="border-t border-border pt-6">
          <label className="mb-1.5 block text-sm text-muted-foreground">status</label>
          <div className="flex gap-2">
            <Input
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveStatus()}
              placeholder="on rotation"
              className="bg-card border-border"
              maxLength={80}
            />
            <button
              onClick={handleSaveStatus}
              disabled={saving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {saving ? "..." : statusSaved ? "saved ✓" : "save"}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {status.length}/80 · shown on your profile
          </span>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">moon appearance</h3>
          <label className="mb-1.5 block text-sm text-muted-foreground">moon colour</label>
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
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
              style={{ touchAction: "manipulation" }}
            >
              save
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">current mood</h3>
          <p className="text-[10px] text-muted-foreground mb-3">
            sets your vibe — subtly tints the glow on your profile moon
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
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
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
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            connected platforms
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-foreground">Spotify</span>
              <span className="text-xs text-muted-foreground ml-auto">connected</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${tidalConnected ? "bg-green-500" : "bg-muted"}`} />
              <span className="text-sm text-foreground">Tidal</span>
              {tidalConnected ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">connected</span>
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
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="text-sm text-foreground">Apple Music</span>
              <span className="text-xs text-muted-foreground italic ml-auto">coming soon</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${youtubeConnected ? "bg-green-500" : "bg-muted"}`} />
              <span className="text-sm text-foreground">YouTube Music</span>
              {youtubeConnected ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">connected</span>
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
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">privacy</h3>
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
          <div className="mt-6">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">quick login PIN</h4>
            <p className="text-xs text-muted-foreground mb-2">set a 4-digit PIN to sign in quickly next time</p>
            <div className="flex gap-2">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="bg-card border-border w-24 text-center tracking-[0.3em]"
              />
              <button
                onClick={handleSavePin}
                disabled={pinSaving || pin.length !== 4}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
                style={{ touchAction: "manipulation" }}
              >
                {pinSaving ? "saving..." : "save"}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">push notifications</h3>
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

        {/* Extra padding so admin button is never hidden by mini player */}
        <div className="pt-2 pb-24 text-center">
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
