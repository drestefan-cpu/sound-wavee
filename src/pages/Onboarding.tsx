import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Loader2 } from "lucide-react";
import UserCard from "@/components/UserCard";
import PlaiLogo from "@/components/PlaiLogo";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || "");
    }
  }, [user]);

  // Check if already onboarded
  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .single();
      if ((data as any)?.onboarding_complete) {
        navigate("/feed", { replace: true });
      }
    };
    check();
  }, [user, navigate]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "");
    await supabase
      .from("profiles")
      .update({ display_name: displayName, username: slug || null })
      .eq("id", user.id);
    setStep(1);
    // Auto-start sync
    handleSync();
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

  const handleFinish = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_complete: true } as any)
        .eq("id", user.id);
    }
    navigate("/feed");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-feed">
        {step === 0 && (
          <div className="flex flex-col items-center gap-6 animate-slide-in">
            <PlaiLogo className="text-5xl" />
            <p className="text-lg font-light text-foreground">
              welcome, {displayName || "friend"}
            </p>
            <div className="w-full space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">pick a username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  placeholder="yourname"
                  className="bg-card border-border"
                />
              </div>
              <Button className="w-full" onClick={handleSaveProfile}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center gap-6 animate-slide-in">
            <PlaiLogo className="text-4xl" />
            {syncing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">importing your likes from Spotify</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-lg font-medium text-primary">
                  {syncCount} tracks imported
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-slide-in">
            <div className="text-center">
              <h2 className="font-display text-2xl text-foreground">find friends</h2>
              <p className="mt-1 text-muted-foreground">follow people to see their music</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="search by username..."
                className="bg-card border-border pl-10"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suggestedUsers.map((u) => (
                <UserCard key={u.id} profile={u} showFollow />
              ))}
              {suggestedUsers.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  no users found yet
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 text-muted-foreground"
                onClick={handleFinish}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleFinish}
              >
                Go to feed
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
