import { useEffect, useState, useRef } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, RefreshCw } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FollowButton from "@/components/FollowButton";
import PlaiLogo from "@/components/PlaiLogo";
import PageHeader from "@/components/PageHeader";
import FlappyBird from "@/components/FlappyBird";
import { getSpotifyUrl } from "@/lib/songlink";
import { Skeleton } from "@/components/ui/skeleton";

const Profile = () => {
  const { username } = useParams();
  const { user, loading, triggerSync } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [likes, setLikes] = useState<any[]>([]);
  const [savedTracks, setSavedTracks] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [tab, setTab] = useState<"finds" | "collection">("finds");
  const [showFlappy, setShowFlappy] = useState(false);
  const [usernameEdit, setUsernameEdit] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isOwnProfile = profile?.id === user?.id;

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled && !profile) setProfileFailed(true);
    }, 5000);

    const load = async () => {
      try {
        if (username) {
          const { data: byUsername } = await supabase
            .from("profiles").select("*").eq("username", username).maybeSingle();
          if (!cancelled) {
            if (byUsername) { setProfile(byUsername); return; }
            const { data: byId } = await supabase
              .from("profiles").select("*").eq("id", username).maybeSingle();
            setProfile(byId);
            if (!byId) setProfileFailed(true);
          }
        } else if (user) {
          const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          if (!cancelled) {
            setProfile(data);
            if (!data) setProfileFailed(true);
          }
        }
      } catch {
        if (!cancelled) setProfileFailed(true);
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [username, user]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled) setDataLoaded(true); }, 5000);

    const loadData = async () => {
      try {
        const [likesRes, savedRes, fcRes, fgcRes, lcRes] = await Promise.all([
          supabase.from("likes").select("*, tracks(*)").eq("user_id", profile.id).order("liked_at", { ascending: false }).limit(30),
          isOwnProfile ? supabase.from("saved_tracks").select("*, tracks(*)").eq("user_id", profile.id).order("saved_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
          supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
        ]);
        if (!cancelled) {
          setLikes(likesRes.data || []);
          setSavedTracks((savedRes as any).data || []);
          setFollowerCount(fcRes.count || 0);
          setFollowingCount(fgcRes.count || 0);
          setLikesCount(lcRes.count || 0);
          setDataLoaded(true);
        }
      } catch {
        if (!cancelled) setDataLoaded(true);
      }
    };
    loadData();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [profile, isOwnProfile]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const count = await triggerSync();
    setSyncing(false);
    setSyncResult(`✓ ${count} tracks synced`);
    setTimeout(() => setSyncResult(null), 2000);
    // Refresh data
    const { data } = await supabase.from("likes").select("*, tracks(*)").eq("user_id", profile.id).order("liked_at", { ascending: false }).limit(30);
    setLikes(data || []);
    const { count: total } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", profile.id);
    setLikesCount(total || 0);
  };

  const handleEasterEggTap = () => {
    tapCountRef.current++;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      setShowFlappy(true);
      return;
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const slug = newUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    await supabase.from("profiles").update({ username: slug }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, username: slug }));
    setUsernameEdit(false);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  // Loading skeleton
  if (!profile && !profileFailed) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Profile" />
        <main className="mx-auto max-w-feed px-4 py-6">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-6">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-16" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (profileFailed && !profile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Profile" />
        <main className="mx-auto max-w-feed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">couldn't load profile</p>
          <button onClick={() => { setProfileFailed(false); window.location.reload(); }} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
            retry
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const displayName = profile.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "musician";

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title={`@${profile.username || "user"}`}
        rightContent={
          isOwnProfile ? (
            <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors duration-150">
              <Settings className="h-5 w-5" />
            </Link>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-feed px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-primary/20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl text-primary-foreground bg-primary">
                {displayName[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-medium text-foreground">{displayName}</h2>
            {profile.username ? (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            ) : isOwnProfile ? (
              usernameEdit ? (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      className="rounded-full bg-card border border-border px-3 py-1 text-sm text-foreground w-32"
                      placeholder="username"
                    />
                    <button onClick={handleSaveUsername} className="text-xs text-primary">save</button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">letters, numbers, . _ - only</span>
                </div>
              ) : (
                <button onClick={() => setUsernameEdit(true)} className="text-sm text-primary hover:underline mt-1">
                  add username →
                </button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">@user</p>
            )}
          </div>
          <div className="flex gap-6 text-center text-sm">
            <div><p className="font-medium text-foreground">{followerCount}</p><p className="text-muted-foreground">followers</p></div>
            <div><p className="font-medium text-foreground">{followingCount}</p><p className="text-muted-foreground">following</p></div>
            <div><p className="font-medium text-foreground">{likesCount}</p><p className="text-muted-foreground">collection</p></div>
          </div>
          {isOwnProfile ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "syncing..." : syncResult || "sync now"}
            </button>
          ) : (
            <FollowButton targetUserId={profile.id} />
          )}
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-2 mb-4">
          <button
            onClick={() => setTab("finds")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "finds" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            your finds
          </button>
          <button
            onClick={() => setTab("collection")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "collection" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            your collection
          </button>
        </div>

        {!dataLoaded ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : tab === "finds" ? (
          savedTracks.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {savedTracks.map((s: any) => (
                <a
                  key={s.id}
                  href={getSpotifyUrl(s.tracks?.spotify_track_id, s.tracks?.title, s.tracks?.artist)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg bg-card border border-border hover:opacity-80 transition-opacity duration-150"
                >
                  {s.tracks?.album_art_url ? (
                    <img src={s.tracks.album_art_url} alt={s.tracks?.title || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">🎵</div>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              songs you discover on PLAI live here — save them from the feed
            </p>
          )
        ) : (
          likes.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {likes.map((like: any) => (
                <a
                  key={like.id}
                  href={getSpotifyUrl(like.tracks?.spotify_track_id, like.tracks?.title, like.tracks?.artist)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg bg-card border border-border hover:opacity-80 transition-opacity duration-150"
                >
                  {like.tracks?.album_art_url ? (
                    <img src={like.tracks.album_art_url} alt={like.tracks?.title || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">🎵</div>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              your Spotify likes will appear here — tap sync to import
            </p>
          )
        )}

        {/* Easter egg */}
        <div className="mt-20 flex justify-center">
          <button onClick={handleEasterEggTap} className="text-[10px] text-muted-dim select-none">
            PLAI
          </button>
        </div>
      </main>

      {showFlappy && <FlappyBird onClose={() => setShowFlappy(false)} />}
      <BottomNav />
    </div>
  );
};

export default Profile;
