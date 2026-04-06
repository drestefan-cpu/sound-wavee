import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import TaglineSpace from "@/components/TaglineSpace";

const SettingsPage = () => {
  const { user, loading, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pin, setPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setIsPublic((data as any).public !== false);
        setStatus((data as any).status || "");
      }
    };
    load();
  }, [user]);

  const handleSave = async (field: string, value: any) => {
    if (!user) return;
    setSaving(true);
    const update: any = {};
    if (field === "display_name") update.display_name = value;
    if (field === "username") update.username = value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (field === "public") update.public = value;
    if (field === "status") update.status = value;
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to update");
    else toast.success("Updated");
  };

  const handleSavePin = async () => {
    if (!user || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    setPinSaving(true);
    // Try RPC first (hashed), fallback to plain text
    const { error } = await (supabase.rpc as any)("set_login_pin", { p_user_id: user.id, p_pin: pin });
    if (error) {
      // Fallback: store plain
      const { error: e2 } = await supabase.from("profiles").update({ login_pin: pin } as any).eq("id", user.id);
      setPinSaving(false);
      if (e2) toast.error("Failed to save PIN");
      else { toast.success("PIN saved"); setPin(""); }
    } else {
      setPinSaving(false);
      toast.success("PIN saved");
      setPin("");
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Settings" />

      <main className="mx-auto max-w-feed px-4 py-6 space-y-6">
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">display name</label>
          <div className="flex gap-2">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-card border-border" />
            <button onClick={() => handleSave("display_name", displayName)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80">
              save
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">username</label>
          <div className="flex gap-2">
            <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} className="bg-card border-border" />
            <button onClick={() => handleSave("username", username)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80">
              save
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">letters, numbers, . _ - only</span>
        </div>

        <div className="border-t border-border pt-6">
          <label className="mb-1.5 block text-sm text-muted-foreground">status</label>
          <div className="flex gap-2">
            <Input
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 80))}
              placeholder="on rotation"
              className="bg-card border-border"
              maxLength={80}
            />
            <button
              onClick={async () => {
                if (!user) return;
                setSaving(true);
                const { error } = await supabase.from("profiles").update({ status }).eq("id", user.id);
                setSaving(false);
                if (error) {
                  toast.error("Failed to save status — tap to retry");
                  console.error("Status save error:", error);
                } else {
                  toast.success("Status updated");
                }
              }}
              disabled={saving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50"
            >
              {saving ? "..." : "save"}
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">{status.length}/80 · shown on your profile</span>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">quick login PIN</h3>
          <p className="text-xs text-muted-foreground mb-2">set a 4-digit PIN to sign in quickly next time</p>
          <p className="text-[10px] text-muted-dim mb-2">PIN is for convenience only, not a security feature.</p>
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
            >
              {pinSaving ? "saving..." : "save"}
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">connected platforms</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-foreground">Spotify</span>
              <span className="text-xs text-muted-foreground ml-auto">connected</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="text-sm text-foreground">Apple Music</span>
              <span className="text-xs text-muted-foreground italic ml-auto">coming soon</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="text-sm text-foreground">YouTube Music</span>
              <span className="text-xs text-muted-foreground italic ml-auto">coming soon</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="text-sm text-foreground">Tidal</span>
              <span className="text-xs text-muted-foreground italic ml-auto">coming soon</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">notifications</h3>
          <label className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm text-foreground">push notifications</p>
              <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[10px] text-muted-foreground">coming soon</span>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted cursor-not-allowed opacity-50">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </label>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">privacy</h3>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">public profile</p>
              <p className="text-xs text-muted-foreground">visible in discover and search</p>
            </div>
            <button
              onClick={() => { setIsPublic(!isPublic); handleSave("public", !isPublic); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ${isPublic ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${isPublic ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </div>

        <div className="border-t border-border pt-12 pb-6">
          <TaglineSpace />
          <p className="text-center text-[10px] text-muted-foreground/40 mt-6">v0.1 beta · from old provençal — "it pleases me"</p>
        </div>

        <div className="border-t border-border pt-6">
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10"
          >
            <LogOut className="h-4 w-4" />
            sign out
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default SettingsPage;
