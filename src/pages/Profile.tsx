import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Settings } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FollowButton from "@/components/FollowButton";

const Profile = () => {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const isOwnProfile = profile?.id === user?.id;

  useEffect(() => {
    const load = async () => {
      let query = supabase.from("profiles").select("*");
      if (username) {
        query = query.eq("username", username);
      } else if (user) {
        query = query.eq("id", user.id);
      }
      const { data } = await query.single();
      if (data) {
        setProfile(data);
        // Load tracks
        const { data: likes } = await supabase
          .from("likes")
          .select("*, tracks(*)")
          .eq("user_id", data.id)
          .order("liked_at", { ascending: false })
          .limit(30);
        setTracks(likes || []);

        // Counts
        const { count: fc } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", data.id);
        setFollowerCount(fc || 0);

        const { count: fgc } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", data.id);
        setFollowingCount(fgc || 0);
      }
    };
    load();
  }, [username, user]);

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
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <Link to="/feed" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-semibold">
            @{profile.username || "user"}
          </h1>
          {isOwnProfile && (
            <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="h-5 w-5" />
            </Link>
          )}
          {!isOwnProfile && <div className="w-5" />}
        </div>
      </header>

      <main className="mx-auto max-w-feed px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-card">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {(profile.display_name || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{profile.display_name || "User"}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username || "user"}</p>
          </div>
          <div className="flex gap-6 text-center text-sm">
            <div>
              <p className="font-semibold">{followerCount}</p>
              <p className="text-muted-foreground">followers</p>
            </div>
            <div>
              <p className="font-semibold">{followingCount}</p>
              <p className="text-muted-foreground">following</p>
            </div>
            <div>
              <p className="font-semibold">{tracks.length}</p>
              <p className="text-muted-foreground">likes</p>
            </div>
          </div>
          {isOwnProfile ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
          ) : (
            <FollowButton targetUserId={profile.id} />
          )}
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Likes
          </h3>
          <div className="space-y-2">
            {tracks.map((like: any) => (
              <div
                key={like.id}
                className="flex items-center gap-3 rounded-lg bg-card p-3 border border-border transition-colors"
              >
                {like.tracks?.album_art_url && (
                  <img
                    src={like.tracks.album_art_url}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{like.tracks?.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {like.tracks?.artist}
                  </p>
                </div>
              </div>
            ))}
            {tracks.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No liked tracks yet
              </p>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
