import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Settings } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FollowButton from "@/components/FollowButton";
import PlaiLogo from "@/components/PlaiLogo";

const Profile = () => {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const isOwnProfile = profile?.id === user?.id;

  useEffect(() => {
    const load = async () => {
      let query = supabase.from("profiles").select("*");
      if (username) {
        // Try username first, fall back to id
        const { data: byUsername } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .maybeSingle();
        
        if (byUsername) {
          setProfile(byUsername);
        } else {
          const { data: byId } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", username)
            .maybeSingle();
          setProfile(byId);
        }
      } else if (user) {
        const { data } = await query.eq("id", user.id).single();
        setProfile(data);
      }
    };
    load();
  }, [username, user]);

  useEffect(() => {
    if (!profile) return;
    const loadData = async () => {
      const { data: likes } = await supabase
        .from("likes")
        .select("*, tracks(*)")
        .eq("user_id", profile.id)
        .order("liked_at", { ascending: false })
        .limit(30);
      setTracks(likes || []);

      const { count: fc } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id);
      setFollowerCount(fc || 0);

      const { count: fgc } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id);
      setFollowingCount(fgc || 0);

      const { count: lc } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setLikesCount(lc || 0);
    };
    loadData();
  }, [profile]);

  const handleSync = async () => {
    setSyncing(true);
    await supabase.functions.invoke("sync-spotify-likes", {
      body: { user_id: user?.id },
    });
    setSyncing(false);
    window.location.reload();
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <Link to="/feed" className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-medium text-foreground">@{profile.username || "user"}</span>
          {isOwnProfile ? (
            <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors duration-150">
              <Settings className="h-5 w-5" />
            </Link>
          ) : (
            <div className="w-5" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-feed px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-primary/20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                {(profile.display_name || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-medium text-foreground">{profile.display_name || "User"}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username || "user"}</p>
          </div>
          <div className="flex gap-6 text-center text-sm">
            <div>
              <p className="font-medium text-foreground">{followerCount}</p>
              <p className="text-muted-foreground">followers</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{followingCount}</p>
              <p className="text-muted-foreground">following</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{likesCount}</p>
              <p className="text-muted-foreground">likes</p>
            </div>
          </div>
          {isOwnProfile ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
          ) : (
            <FollowButton targetUserId={profile.id} />
          )}
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Likes
          </h3>
          {tracks.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {tracks.map((like: any) => (
                <div key={like.id} className="aspect-square overflow-hidden rounded-lg bg-card border border-border">
                  {like.tracks?.album_art_url ? (
                    <img src={like.tracks.album_art_url} alt={like.tracks?.title || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                      🎵
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No liked tracks yet
            </p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
