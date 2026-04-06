import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, RefreshCw, QrCode, X, Copy, Bell, Users, Heart } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FollowButton from "@/components/FollowButton";
import PlaiLogo from "@/components/PlaiLogo";
import PageHeader from "@/components/PageHeader";
import FlappyBird from "@/components/FlappyBird";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import EmojiReactions from "@/components/EmojiReactions";
import FollowersModal from "@/components/FollowersModal";
import { getSpotifyUrl } from "@/lib/songlink";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

type TabType = "finds" | "collection" | "following" | "activity" | "foryou";

const Profile = () => {
  const { username } = useParams();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [likes, setLikes] = useState<any[]>([]);
  const [savedTracks, setSavedTracks] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [findsCount, setFindsCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>("finds");
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<"30d" | "all">("30d");
  const [showFlappy, setShowFlappy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [usernameEdit, setUsernameEdit] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoaded, setRecsLoaded] = useState(false);
  const [tasteMatch, setTasteMatch] = useState<number | null>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [moonsFaded, setMoonsFaded] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isOwnProfile = profile?.id === user?.id;

  // Load profile
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled && !profile) setProfileFailed(true); }, 5000);
    const load = async () => {
      try {
        if (username) {
          const { data: byUsername } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
          if (!cancelled) {
            if (byUsername) { setProfile(byUsername); return; }
            const { data: byId } = await supabase.from("profiles").select("*").eq("id", username).maybeSingle();
            setProfile(byId);
            if (!byId) setProfileFailed(true);
          }
        } else if (user) {
          const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          if (!cancelled) { setProfile(data); if (!data) setProfileFailed(true); }
        }
      } catch { if (!cancelled) setProfileFailed(true); }
    };
    load();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [username, user]);

  const loadCollection = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from("likes")
      .select("id, liked_at, user_id, track_id, tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)")
      .eq("user_id", profile.id).order("liked_at", { ascending: false }).limit(100);
    setLikes(data || []);
    const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", profile.id);
    setLikesCount(count || 0);
  }, [profile]);

  // Load all data
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled) setDataLoaded(true); }, 5000);
    const loadData = async () => {
      try {
        const [likesRes, savedRes, fcRes, fgcRes, lcRes, scRes] = await Promise.all([
          supabase.from("likes").select("id, liked_at, user_id, track_id, tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)").eq("user_id", profile.id).order("liked_at", { ascending: false }).limit(100),
          supabase.from("saved_tracks").select("*, tracks(*), profiles!saved_tracks_source_user_id_fkey(username, display_name, avatar_url)").eq("user_id", profile.id).order("saved_at", { ascending: false }).limit(50),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
          supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
          supabase.from("saved_tracks").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
        ]);
        if (!cancelled) {
          setLikes(likesRes.data || []);
          setSavedTracks((savedRes as any).data || []);
          setFollowerCount(fcRes.count || 0);
          setFollowingCount(fgcRes.count || 0);
          setLikesCount(lcRes.count || 0);
          setFindsCount(scRes.count || 0);
          setDataLoaded(true);
        }
      } catch { if (!cancelled) setDataLoaded(true); }
    };
    loadData();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [profile]);

  // Load followers for moons
  useEffect(() => {
    if (!isOwnProfile || !profile) return;
    const loadFollowers = async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(id, username, profile_color)")
        .eq("following_id", profile.id).limit(50);
      setFollowers((data || []).map((f: any) => f.profiles).filter(Boolean));
      setTimeout(() => setMoonsFaded(true), 2500);
    };
    loadFollowers();
  }, [isOwnProfile, profile]);

  // Taste match
  useEffect(() => {
    if (isOwnProfile || !user || !profile) return;
    const loadMatch = async () => {
      const { data } = await supabase
        .from("taste_compatibility" as any).select("score")
        .or(`and(user_a.eq.${user.id},user_b.eq.${profile.id}),and(user_a.eq.${profile.id},user_b.eq.${user.id})`)
        .maybeSingle();
      if (data) setTasteMatch((data as any).score);
    };
    loadMatch();
  }, [isOwnProfile, user, profile]);

  // Following list
  useEffect(() => {
    if (!isOwnProfile || !user || tab !== "following") return;
    const loadFollowing = async () => {
      setFollowingLoaded(false);
      const { data } = await supabase
        .from("follows").select("following_id, profiles!follows_following_id_fkey(id, display_name, username, avatar_url)")
        .eq("follower_id", user.id).order("created_at", { ascending: false });
      setFollowingList(data || []);
      setFollowingLoaded(true);
    };
    loadFollowing();
  }, [isOwnProfile, user, tab]);

  // Activity
  useEffect(() => {
    if (!isOwnProfile || !user || tab !== "activity") return;
    const loadActivity = async () => {
      const [saveRes, reactionRes] = await Promise.all([
        supabase.from("saved_tracks")
          .select("saved_at, source_context, profiles!saved_tracks_user_id_fkey(username, display_name, avatar_url), tracks(title, artist, spotify_track_id)")
          .eq("source_user_id", user.id).order("saved_at", { ascending: false }).limit(50),
        supabase.from("reactions")
          .select("emoji, created_at, profiles!reactions_user_id_fkey(username, display_name, avatar_url), likes!reactions_like_id_fkey(user_id, tracks(title, artist))")
          .order("created_at", { ascending: false }).limit(50),
      ]);
      const saves = (saveRes.data || []).map((s: any) => ({
        type: "save" as const, timestamp: s.saved_at,
        username: s.profiles?.username, displayName: s.profiles?.display_name,
        avatarUrl: s.profiles?.avatar_url, trackTitle: s.tracks?.title, trackArtist: s.tracks?.artist,
      }));
      const reactions = ((reactionRes.data || []) as any[])
        .filter((r: any) => r.likes?.user_id === user.id)
        .map((r: any) => ({
          type: "reaction" as const, timestamp: r.created_at,
          username: r.profiles?.username, displayName: r.profiles?.display_name,
          avatarUrl: r.profiles?.avatar_url, emoji: r.emoji, trackTitle: r.likes?.tracks?.title,
        }));
      setActivity([...saves, ...reactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setActivityLoaded(true);
    };
    loadActivity();
  }, [isOwnProfile, user, tab]);

  // Recommendations
  useEffect(() => {
    if (!isOwnProfile || !user || tab !== "foryou") return;
    const loadRecs = async () => {
      const { data } = await supabase
        .from("recommendations" as any)
        .select("*, tracks(*), profiles:from_user_id(display_name, username, avatar_url)")
        .eq("to_user_id", user.id).order("created_at", { ascending: false }).limit(50);
      setRecommendations(data || []);
      setRecsLoaded(true);
    };
    loadRecs();
  }, [isOwnProfile, user, tab]);

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setSyncResult('syncing...');
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('sync-spotify-likes', {
        body: { user_id: user.id },
        headers: { Authorization: `Bearer ${currentSession?.access_token}` },
      });
      if (error) { setSyncResult('could not sync — try signing out and back in'); }
      else { setSyncResult(`✓ ${data?.count || 0} tracks synced`); setTimeout(() => loadCollection(), 1000); }
    } catch { setSyncResult('could not sync — unexpected error'); }
    finally { setSyncing(false); setTimeout(() => setSyncResult(null), 4000); }
  };

  const handleRemoveSaved = async (savedId: string) => {
    setSavedTracks(prev => prev.filter(s => s.id !== savedId));
    await supabase.from("saved_tracks").delete().eq("id", savedId);
  };

  const handleEasterEggTap = () => {
    tapCountRef.current++;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 7) { tapCountRef.current = 0; setShowFlappy(true); return; }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const slug = newUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    await supabase.from("profiles").update({ username: slug }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, username: slug }));
    setUsernameEdit(false);
  };

  const copyProfileLink = () => {
    const link = `https://sound-wavee.lovable.app/profile/${profile?.username || profile?.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Profile link copied");
  };

  const moons = useMemo(() => {
    return followers.slice(0, 50).map((f) => ({
      id: f.id, username: f.username,
      color: f.profile_color || "#FF2D78",
      left: seededRandom(f.id + "x") * 80 + 10,
      top: seededRandom(f.id + "y") * 30 + 5,
      size: 8 + seededRandom(f.id + "s") * 12,
    }));
  }, [followers]);

  if (loading) return null;
  if (!user && !username) return <Navigate to="/" replace />;

  if (!profile && !profileFailed) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Profile" />
        <main className="mx-auto max-w-feed px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
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
        <main className="mx-auto max-w-feed px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">couldn't load profile</p>
          <button onClick={() => { setProfileFailed(false); window.location.reload(); }} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">retry</button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const displayName = profile.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "musician";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const filteredLikes = collectionFilter === "30d" ? likes.filter(l => l.liked_at >= thirtyDaysAgo) : likes;
  const findsLabel = isOwnProfile ? "your finds" : "finds";
  const collectionLabel = isOwnProfile ? "your collection" : "collection";
  const profileBg = (profile as any)?.profile_color || "#080B12";

  return (
    <div className="min-h-screen pb-20" style={{ background: `linear-gradient(180deg, ${profileBg}40 0%, hsl(218 32% 5%) 300px)` }}>
      <PageHeader
        title={`@${profile.username || "user"}`}
        rightContent={
          isOwnProfile ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQR(true)} className="text-muted-foreground hover:text-foreground transition-colors duration-150"><QrCode className="h-5 w-5" /></button>
              <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors duration-150"><Settings className="h-5 w-5" /></Link>
            </div>
          ) : (
            <button onClick={() => setShowQR(true)} className="text-muted-foreground hover:text-foreground transition-colors duration-150"><QrCode className="h-5 w-5" /></button>
          )
        }
      />

      <main className="mx-auto max-w-feed px-4 py-4 relative">
        {/* Follower moons with pulse + drift */}
        {isOwnProfile && moons.length > 0 && (
          <div className="absolute inset-x-0 top-0 h-32 pointer-events-none overflow-hidden">
            <style>{`
              @keyframes moon-drift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(var(--mdx), var(--mdy)); } }
              @keyframes moon-pulse { 0%, 100% { opacity: var(--mo); } 50% { opacity: calc(var(--mo) * 0.5); } }
              @media (prefers-reduced-motion: reduce) { .moon-el { animation: none !important; } }
            `}</style>
            {moons.map((m) => (
              <div
                key={m.id}
                className="absolute flex flex-col items-center moon-el"
                style={{
                  left: `${m.left}%`, top: `${m.top}%`,
                  "--mdx": `${(seededRandom(m.id + "dx") - 0.5) * 6}px`,
                  "--mdy": `${(seededRandom(m.id + "dy") - 0.5) * 4}px`,
                  "--mo": "0.4",
                  animation: `moon-drift ${10 + seededRandom(m.id + "d") * 8}s ease-in-out infinite, moon-pulse ${4 + seededRandom(m.id + "p") * 4}s ease-in-out infinite`,
                } as React.CSSProperties}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: m.size, height: m.size, backgroundColor: m.color, opacity: 0.4,
                    boxShadow: `0 0 ${m.size}px ${m.color}40`,
                  }}
                />
                <span className="text-[8px] mt-0.5 transition-opacity duration-1000" style={{ color: '#F0EBE3', opacity: moonsFaded ? 0 : 0.8 }}>
                  @{m.username || "·"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Profile header — compact */}
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-primary/20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xl text-primary-foreground bg-primary">
                {displayName[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-medium text-foreground">{displayName}</h2>
            {profile.username ? (
              <p className="text-xs text-muted-foreground">@{profile.username}</p>
            ) : isOwnProfile ? (
              usernameEdit ? (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} className="rounded-full bg-card border border-border px-3 py-1 text-sm text-foreground w-32" placeholder="username" />
                    <button onClick={handleSaveUsername} className="text-xs text-primary">save</button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">letters, numbers, . _ - only</span>
                </div>
              ) : (
                <button onClick={() => setUsernameEdit(true)} className="text-sm text-primary hover:underline mt-1">add username →</button>
              )
            ) : (
              <p className="text-xs text-muted-foreground">@user</p>
            )}
            {profile?.status && (
              <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">"{profile.status}"</p>
            )}
            {!isOwnProfile && tasteMatch !== null && (
              <span className="inline-block mt-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {tasteMatch}% taste match
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-5 text-center text-xs">
            {isOwnProfile ? (
              <>
                <button onClick={() => setFollowModal("followers")} className="hover:opacity-80 transition-opacity">
                  <p className="font-medium text-foreground text-sm">{followerCount}</p>
                  <p className="text-muted-foreground">followers</p>
                </button>
                <button onClick={() => setFollowModal("following")} className="hover:opacity-80 transition-opacity">
                  <p className="font-medium text-foreground text-sm">{followingCount}</p>
                  <p className="text-muted-foreground">following</p>
                </button>
                <div>
                  <p className="font-medium text-foreground text-sm">{likesCount}</p>
                  <p className="text-muted-foreground">collection</p>
                </div>
              </>
            ) : (
              <>
                <div><p className="font-medium text-foreground text-sm">{findsCount}</p><p className="text-muted-foreground">finds</p></div>
                <div><p className="font-medium text-foreground text-sm">{likesCount}</p><p className="text-muted-foreground">collection</p></div>
              </>
            )}
          </div>

          {isOwnProfile ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-all duration-150 hover:border-primary hover:text-primary"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "syncing..." : syncResult || "sync"}
            </button>
          ) : (
            <FollowButton targetUserId={profile.id} />
          )}
          {isOwnProfile && profile.last_synced_at && (
            <p className="text-[9px] text-muted-foreground -mt-2">
              last synced {(() => {
                const mins = Math.round((Date.now() - new Date(profile.last_synced_at).getTime()) / 60000);
                if (mins < 1) return "just now";
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.round(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.round(hrs / 24)}d ago`;
              })()}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5 mb-3">
          {[
            { key: "finds" as TabType, label: findsLabel },
            { key: "collection" as TabType, label: collectionLabel },
            ...(isOwnProfile ? [
              { key: "following" as TabType, label: "following", icon: <Users className="h-3 w-3" /> },
              { key: "activity" as TabType, label: "activity", icon: <Bell className="h-3 w-3" /> },
              { key: "foryou" as TabType, label: "for you", icon: <Heart className="h-3 w-3" /> },
            ] : []),
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150 whitespace-nowrap flex items-center gap-1 ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {'icon' in t && t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {!dataLoaded ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          </div>
        ) : tab === "finds" ? (
          savedTracks.length > 0 ? (
            <div className="space-y-2">
              {savedTracks.map((s: any) => (
                <UnifiedTrackCard
                  key={s.id}
                  compact
                  hideReactions
                  track={{
                    id: s.id,
                    title: s.tracks?.title || "Unknown",
                    artist: s.tracks?.artist || "Unknown",
                    albumArtUrl: s.tracks?.album_art_url,
                    spotifyTrackId: s.tracks?.spotify_track_id,
                  }}
                  subtitle={
                    <p className="text-[10px] text-muted-dim">
                      {s.source_context === "trending" ? "from trending" :
                       s.profiles?.username ? `from @${s.profiles.username}` :
                       s.profiles?.display_name ? `from ${s.profiles.display_name}` : "from feed"}
                    </p>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isOwnProfile ? "songs you discover on PLAI live here — save them from the feed" : "no finds yet"}
            </p>
          )
        ) : tab === "following" ? (
          !followingLoaded ? (
            <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : followingList.length > 0 ? (
            <div className="space-y-1.5">
              {followingList.map((f: any) => {
                const p = f.profiles;
                if (!p) return null;
                return (
                  <Link key={p.id} to={`/profile/${p.username || p.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 hover:bg-card/80 transition-colors">
                    <div className="h-9 w-9 overflow-hidden rounded-full flex-shrink-0" style={{ backgroundColor: '#FF2D78' }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">{(p.display_name || "U")[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.display_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">@{p.username || "user"}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">you're not following anyone yet — find friends in the people tab</p>
            </div>
          )
        ) : tab === "activity" ? (
          <div className="space-y-1.5">
            {activityLoaded && activity.length === 0 ? (
              <div className="space-y-2">
                <p className="py-3 text-center text-sm text-muted-foreground">when people save or react to your songs, you'll see it here.</p>
                <div className="rounded-xl border border-border bg-card p-2.5 opacity-50 relative border-l-4 border-l-primary">
                  <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] text-muted-foreground">example</span>
                  <p className="text-sm text-foreground">@musicfan saved <span className="text-primary">Beautiful Things</span></p>
                </div>
                <div className="rounded-xl border border-border bg-card p-2.5 opacity-50 relative">
                  <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] text-muted-foreground">example</span>
                  <p className="text-sm text-foreground">@friend reacted 🔥 to <span className="text-primary">Swim</span></p>
                </div>
              </div>
            ) : !activityLoaded ? (
              <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : (
              activity.map((item, i) => (
                <div key={i} className={`rounded-xl border border-border bg-card p-2.5 ${item.type === "save" ? "border-l-4 border-l-primary" : ""}`}>
                  <div className="flex items-center gap-2">
                    {item.avatarUrl && (
                      <div className="h-5 w-5 overflow-hidden rounded-full bg-primary/20 flex-shrink-0">
                        <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="text-xs text-foreground">
                      {item.type === "save" ? (
                        <>
                          <Link to={`/profile/${item.username}`} className="text-primary hover:underline">@{item.username || item.displayName}</Link>
                          {" saved "}<span className="text-primary">{item.trackTitle}</span>
                        </>
                      ) : (
                        <>
                          <Link to={`/profile/${item.username}`} className="text-primary hover:underline">@{item.username || item.displayName}</Link>
                          {" reacted "}{item.emoji}{" to "}<span className="text-primary">{item.trackTitle}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === "foryou" ? (
          <div className="space-y-2">
            {recsLoaded && recommendations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">when someone recommends you a song, it'll appear here.</p>
            ) : !recsLoaded ? (
              <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : (
              recommendations.map((rec: any) => (
                <UnifiedTrackCard
                  key={rec.id}
                  compact
                  hideReactions
                  track={{
                    id: rec.id,
                    title: rec.tracks?.title || "Unknown",
                    artist: rec.tracks?.artist || "Unknown",
                    albumArtUrl: rec.tracks?.album_art_url,
                    spotifyTrackId: rec.tracks?.spotify_track_id,
                  }}
                  subtitle={
                    <p className="text-[10px] text-muted-dim">
                      from @{rec.profiles?.username || rec.profiles?.display_name}
                      {rec.message && <span className="italic"> — "{rec.message}"</span>}
                    </p>
                  }
                />
              ))
            )}
          </div>
        ) : (
          /* Collection tab */
          <>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setCollectionFilter("30d")} className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-150 ${collectionFilter === "30d" ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}>
                last 30 days ({likes.filter(l => l.liked_at >= thirtyDaysAgo).length})
              </button>
              <button onClick={() => setCollectionFilter("all")} className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-150 ${collectionFilter === "all" ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}>
                all time ({likes.length})
              </button>
            </div>
            {filteredLikes.length > 0 ? (
              isOwnProfile ? (
                <div className="space-y-2">
                  {filteredLikes.map((like: any) => (
                    <UnifiedTrackCard
                      key={like.id}
                      compact
                      hideReactions
                      track={{
                        id: like.id,
                        title: like.tracks?.title || "Unknown",
                        artist: like.tracks?.artist || "Unknown",
                        album: like.tracks?.album,
                        albumArtUrl: like.tracks?.album_art_url,
                        spotifyTrackId: like.tracks?.spotify_track_id,
                        likeId: like.id,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLikes.map((like: any) => (
                    <UnifiedTrackCard
                      key={like.id}
                      compact
                      hideReactions
                      track={{
                        id: like.id,
                        title: like.tracks?.title || "Unknown",
                        artist: like.tracks?.artist || "Unknown",
                        album: like.tracks?.album,
                        albumArtUrl: like.tracks?.album_art_url,
                        spotifyTrackId: like.tracks?.spotify_track_id,
                        likeId: like.id,
                      }}
                    />
                  ))}
                </div>
              )
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {isOwnProfile ? "your Spotify likes will appear here — tap sync to import" : "no tracks yet"}
              </p>
            )}
          </>
        )}

        <div className="mt-12 flex justify-center">
          <button onClick={handleEasterEggTap} className="text-[10px] text-muted-dim select-none">PLAI</button>
        </div>
      </main>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full mx-4 text-center relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowQR(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={`https://sound-wavee.lovable.app/profile/${profile?.username || profile?.id}`} size={180} bgColor="transparent" fgColor="#F0EBE3" />
            </div>
            <p className="text-sm text-foreground mb-1">@{profile?.username || "user"}</p>
            <button onClick={copyProfileLink} className="flex items-center justify-center gap-2 mx-auto rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 mt-3">
              <Copy className="h-4 w-4" /> copy profile link
            </button>
          </div>
        </div>
      )}

      {followModal && profile && <FollowersModal profileId={profile.id} mode={followModal} onClose={() => setFollowModal(null)} />}
      {showFlappy && <FlappyBird onClose={() => setShowFlappy(false)} />}
      <BottomNav />
    </div>
  );
};

export default Profile;
