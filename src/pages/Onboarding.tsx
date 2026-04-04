import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Search, ArrowRight, Loader2 } from "lucide-react";
import UserCard from "@/components/UserCard";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "");
    await supabase
      .from("profiles")
      .update({ display_name: displayName, username: slug || null })
      .eq("id", user.id);
    setStep(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: user?.id },
      });
      setSyncCount(data?.count || 0);
    } catch (e) {
      console.error("Sync error:", e);
    }
    setSyncing(false);
    setTimeout(() => setStep(2), 1500);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user?.id || "")
      .limit(20);
    setSuggestedUsers(data || []);
  };

  useEffect(() => {
    if (step === 2) loadUsers();
  }, [step]);

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q) return loadUsers();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user?.id || "")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20);
    setSuggestedUsers(data || []);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-feed">
        {step === 0 && (
          <div className="flex flex-col items-center gap-6 animate-slide-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Music className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold">Welcome to Soundwave</h1>
            <p className="text-muted-foreground">Let's set up your profile</p>
            <div className="w-full space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Display name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="bg-card border-border"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  className="bg-card border-border"
                />
              </div>
              <Button variant="spotify" className="w-full rounded-full" onClick={handleSaveProfile}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center gap-6 animate-slide-in">
            <h2 className="font-display text-2xl font-bold">Sync your music</h2>
            <p className="text-center text-muted-foreground">
              We'll import your recently liked songs from Spotify
            </p>
            {syncing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Syncing your library...</p>
              </div>
            ) : syncCount > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-lg font-semibold text-primary">
                  {syncCount} tracks synced! 🎵
                </p>
              </div>
            ) : (
              <Button variant="spotify" className="rounded-full" onClick={handleSync}>
                Sync now
              </Button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-slide-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Find friends</h2>
              <p className="mt-1 text-muted-foreground">Follow people to see their music</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Search by username..."
                className="bg-card border-border pl-10"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suggestedUsers.map((u) => (
                <UserCard key={u.id} profile={u} showFollow />
              ))}
              {suggestedUsers.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No users found yet
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 text-muted-foreground"
                onClick={() => navigate("/feed")}
              >
                Skip
              </Button>
              <Button
                variant="spotify"
                className="flex-1 rounded-full"
                onClick={() => navigate("/feed")}
              >
                Continue to Feed
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
