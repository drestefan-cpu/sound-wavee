import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, QrCode, X, Copy, Bell, Heart, Send, Sparkle, Library } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FollowButton from "@/components/FollowButton";
import PageHeader from "@/components/PageHeader";
import FlappyBird from "@/components/FlappyBird";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import FollowersModal from "@/components/FollowersModal";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getMoodBySlug, getMoodRing } from "@/lib/moods";

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

type TabType = "finds" | "collection" | "activity" | "foryou";

const logProfileView = async (viewerId: string, profileId: string, tabViewed: string) => {
  if (viewerId === profileId) return;
  try {
    await (supabase.from("profile_views" as any).insert({
      viewer_id: viewerId,
      profile_id: profileId,
      tab_viewed: tabViewed,
    }) as any);
  } catch {}
};

const Profile = () => {
  const { username } = useParams();
  const { user, loading } = useAuth();
  const { isSaved, toggleSave } = useSavedTracks();
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
  const [collectionFilter, setCollectionFilter] = useState<"30d" | "all" | "hidden">("30d");
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
  const [unseenRecCount, setUnseenRecCount] = useState(0);
  const [hiddenTracks, setHiddenTracks] = useState<any[]>([]);
  const [hiddenLoaded, setHiddenLoaded] = useState(false);
  const [collectionExclusionIds, setCollectionExclusionIds] = useState<Set<string>>(new Set());
  const [pendingRemoveTrack, setPendingRemoveTrack] = useState<{ hiddenId: string; trackId: string; title?: string } | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const profileViewLoggedRef = useRef(false);
  const [profileOwnerHiddenIds, setProfileOwnerHiddenIds] = useState<Set<string>>(new Set());

  const isOwnProfile = profile?.id === user?.id;

  useEffect(() => {
    if (!profile || !user || profileViewLoggedRef.current) return;
    profileViewLoggedRef.current = true;
    logProfileView(user.id, profile.id, tab);
  }, [profile, user]);

  useEffect(() => {
    if (!profile || !user || isOwnProfile) return;
    logProfileView(user.id, profile.id, tab);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled && !profile) setProfileFailed(true);
    }, 5000);
    const load = async () => {
      try {
        if (username) {
          const { data: byUsername } = await supabase
            .from("profiles")
            .select("*")
            .eq("username", username)
            .maybeSingle();
          if (!cancelled) {
            if (byUsername) {
              setProfile(byUsername);
              return;
            }
            const { data: byId } = await supabase.from("profiles").select("*").eq("id", username).maybeSingle();
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
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [username, user]);

  const loadCollection = useCallback(async () => {
    if (!profile) return;
    const [likesRes, countRes, exclusionsRes] = await Promise.all([
      supabase
        .from("likes")
        .select(
          "id, liked_at, user_id, track_id, tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)",
        )
        .eq("user_id", profile.id)
        .order("liked_at", { ascending: false })
        .limit(100),
      supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id),
      supabase.from("collection_exclusions" as any).select("track_id").eq("user_id", profile.id),
    ]);
    setLikes(likesRes.data || []);
    setLikesCount(countRes.count || 0);
    setCollectionExclusionIds(new Set(((exclusionsRes.data || []) as any[]).map((row) => row.track_id)));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setDataLoaded(true);
    }, 5000);
    const loadData = async () => {
      try {
        const [likesRes, savedRes, fcRes, fgcRes, lcRes, scRes, exclusionsRes] = await Promise.all([
          supabase
            .from("likes")
            .select(
              "id, liked_at, user_id, track_id, tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)",
            )
            .eq("user_id", profile.id)
            .order("liked_at", { ascending: false })
            .limit(100),
          supabase
            .from("saved_tracks")
            .select("*, tracks(*), profiles!saved_tracks_source_user_id_fkey(username, display_name, avatar_url)")
            .eq("user_id", profile.id)
            .order("saved_at", { ascending: false })
            .limit(50),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
          supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
          supabase.from("saved_tracks").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
          supabase.from("collection_exclusions" as any).select("track_id").eq("user_id", profile.id),
        ]);
        if (!cancelled) {
          setLikes(likesRes.data || []);
          setSavedTracks((savedRes as any).data || []);
          setFollowerCount(fcRes.count || 0);
          setFollowingCount(fgcRes.count || 0);
          setLikesCount(lcRes.count || 0);
          setFindsCount(scRes.count || 0);
          setCollectionExclusionIds(new Set((((exclusionsRes as any).data) || []).map((row: any) => row.track_id)));
          setDataLoaded(true);
        }
      } catch {
        if (!cancelled) setDataLoaded(true);
      }
    };
    loadData();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [profile]);

  // Load own hidden tracks on mount
  useEffect(() => {
    if (!isOwnProfile || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from("hidden_tracks" as any)
        .select("*, tracks(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setHiddenTracks(data || []);
      setHiddenLoaded(true);
    };
    load();
  }, [isOwnProfile, user]);

  useEffect(() => {
    if (!isOwnProfile || !profile) return;
    const loadFollowers = async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(id, username, profile_color)")
        .eq("following_id", profile.id)
        .limit(50);
      setFollowers((data || []).map((f: any) => f.profiles).filter(Boolean));
      setTimeout(() => setMoonsFaded(true), 2500);
    };
    loadFollowers();
  }, [isOwnProfile, profile]);

  useEffect(() => {
    if (isOwnProfile || !user || !profile) return;
    const loadMatch = async () => {
      const { data } = await supabase
        .from("taste_compatibility" as any)
        .select("score")
        .or(`and(user_a.eq.${user.id},user_b.eq.${profile.id}),and(user_a.eq.${profile.id},user_b.eq.${user.id})`)
        .maybeSingle();
      if (data) setTasteMatch((data as any).score);
    };
    loadMatch();
  }, [isOwnProfile, user, profile]);

  useEffect(() => {
    if (isOwnProfile || !profile) return;
    const load = async () => {
      const { data } = await supabase
        .from("hidden_tracks" as any)
        .select("track_id")
        .eq("user_id", profile.id);
      setProfileOwnerHiddenIds(new Set((data || []).map((r: any) => r.track_id)));
    };
    load();
  }, [isOwnProfile, profile]);

  useEffect(() => {
    if (!isOwnProfile || !user) return;
    const loadUnseenCount = async () => {
      const { count } = await supabase
        .from("recommendations" as any)
        .select("*", { count: "exact", head: true })
        .eq("to_user_id", user.id)
        .eq("seen", false);
      setUnseenRecCount(count || 0);
    };
    loadUnseenCount();
  }, [isOwnProfile, user]);

  useEffect(() => {
    if (!isOwnProfile || !user || tab !== "activity") return;
    const loadActivity = async () => {
      const [saveRes, reactionRes, recRes] = await Promise.all([
        supabase
          .from("saved_tracks")
          .select(
            "saved_at, source_context, profiles!saved_tracks_user_id_fkey(username, display_name, avatar_url), tracks(title, artist, spotify_track_id, album_art_url)",
          )
          .eq("source_user_id", user.id)
          .order("saved_at", { ascending: false })
          .limit(50),
        supabase
          .from("reactions")
          .select(
            "emoji, created_at, profiles!reactions_user_id_fkey(username, display_name, avatar_url), likes!reactions_like_id_fkey(user_id, tracks(title, artist))",
          )
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("recommendations" as any)
          .select(
            "created_at, message, tracks(title, artist, album_art_url), profiles:from_user_id(username, display_name, avatar_url)",
          )
          .eq("to_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const saves = (saveRes.data || []).map((s: any) => ({
        type: "save" as const,
        timestamp: s.saved_at,
        username: s.profiles?.username,
        displayName: s.profiles?.display_name,
        avatarUrl: s.profiles?.avatar_url,
        trackTitle: s.tracks?.title,
        trackArtist: s.tracks?.artist,
      }));
      const reactions = ((reactionRes.data || []) as any[])
        .filter((r: any) => r.likes?.user_id === user.id)
        .map((r: any) => ({
          type: "reaction" as const,
          timestamp: r.created_at,
          username: r.profiles?.username,
          displayName: r.profiles?.display_name,
          avatarUrl: r.profiles?.avatar_url,
          emoji: r.emoji,
          trackTitle: r.likes?.tracks?.title,
        }));
      const recs = ((recRes.data || []) as any[]).map((r: any) => ({
        type: "recommendation" as const,
        timestamp: r.created_at,
        username: r.profiles?.username,
        displayName: r.profiles?.display_name,
        avatarUrl: r.profiles?.avatar_url,
        trackTitle: r.tracks?.title,
        albumArtUrl: r.tracks?.album_art_url,
      }));
      setActivity(
        [...saves, ...reactions, ...recs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      );
      setActivityLoaded(true);
      if (unseenRecCount > 0) {
        await supabase
          .from("recommendations" as any)
          .update({ seen: true } as any)
          .eq("to_user_id", user.id)
          .eq("seen", false);
        setUnseenRecCount(0);
      }
    };
    loadActivity();
  }, [isOwnProfile, user, tab]);

  useEffect(() => {
    if (!isOwnProfile || !user || tab !== "foryou") return;
    const loadRecs = async () => {
      const { data } = await supabase
        .from("recommendations" as any)
        .select("*, tracks(*), profiles:from_user_id(display_name, username, avatar_url)")
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setRecommendations(data || []);
      setRecsLoaded(true);
    };
    loadRecs();
  }, [isOwnProfile, user, tab]);

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setSyncResult("syncing...");
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: user.id },
        headers: { Authorization: `Bearer ${currentSession?.access_token}` },
      });
      const { data: prof } = await supabase.from("profiles").select("tidal_access_token").eq("id", user.id).single();
      if (prof?.tidal_access_token) {
        await supabase.functions.invoke("sync-tidal-likes", {
          body: { user_id: user.id },
          headers: { Authorization: `Bearer ${currentSession?.access_token}` },
        });
      }
      if (error) {
        setSyncResult("could not sync — try signing out and back in");
        setTimeout(() => setSyncResult(null), 4000);
      } else {
        setSyncResult("✓ done");
        setTimeout(() => loadCollection(), 1000);
        setTimeout(() => setSyncResult(null), 3500);
      }
    } catch {
      setSyncResult("could not sync");
      setTimeout(() => setSyncResult(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleEasterEggTap = () => {
    tapCountRef.current++;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      setShowFlappy(true);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const slug = newUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    await supabase.from("profiles").update({ username: slug }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, username: slug }));
    setUsernameEdit(false);
  };

  const copyProfileLink = () => {
    const link = `https://onplai.lovable.app/profile/${profile?.username || profile?.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Profile link copied");
  };

  const moons = useMemo(() => {
    return followers.slice(0, 5).map((f, idx, arr) => ({
      id: f.id,
      username: f.username,
      color: f.profile_color || "#FF2D78",
      size: 8 + seededRandom(f.id + "s") * 8,
      orbitDelay: -((idx / arr.length) * 160),
      orbitDuration: 120 + seededRandom(f.id + "t") * 80,
      orbitTopOffset: 28 + seededRandom(f.id + "ot") * 16,
      orbitLeftOffset: (seededRandom(f.id + "ol") - 0.5) * 30,
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
          <button
            onClick={() => {
              setProfileFailed(false);
              window.location.reload();
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            retry
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const displayName =
    profile.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "musician";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const ownHiddenIds = new Set(hiddenTracks.map((h: any) => h.track_id));

  const handleUnhideTrack = async (hiddenId: string) => {
    await (supabase
      .from("hidden_tracks" as any)
      .delete()
      .eq("id", hiddenId) as any);
    setHiddenTracks((prev) => prev.filter((t) => t.id !== hiddenId));
    toast.success("song back in your collection");
  };

  const handleRemoveHiddenTrack = async (hiddenId: string, trackId: string) => {
    if (!user) return;

    await Promise.all([
      supabase
        .from("collection_exclusions" as any)
        .upsert({ user_id: user.id, track_id: trackId } as any, { onConflict: "user_id,track_id" }),
      supabase
        .from("hidden_tracks" as any)
        .delete()
        .eq("id", hiddenId) as any,
      supabase.from("likes").delete().eq("user_id", user.id).eq("track_id", trackId),
      supabase.from("saved_tracks").delete().eq("user_id", user.id).eq("track_id", trackId),
    ]);

    setHiddenTracks((prev) => prev.filter((t) => t.id !== hiddenId));
    setLikes((prev) => prev.filter((like) => like.track_id !== trackId));
    setSavedTracks((prev) => prev.filter((saved) => saved.track_id !== trackId));
    setCollectionExclusionIds((prev) => new Set(prev).add(trackId));
    setLikesCount((prev) => Math.max(0, prev - 1));
    setPendingRemoveTrack(null);
    toast.success("song removed from your collection");
  };

  const filteredLikes = (() => {
    let result = collectionFilter === "30d" ? likes.filter((l) => l.liked_at >= thirtyDaysAgo) : likes;
    result = result.filter((l: any) => !collectionExclusionIds.has(l.track_id));
    if (isOwnProfile) result = result.filter((l: any) => !ownHiddenIds.has(l.track_id));
    else result = result.filter((l: any) => !profileOwnerHiddenIds.has(l.track_id));
    return result;
  })();
  const filteredHiddenTracks = hiddenTracks.filter((h: any) => !collectionExclusionIds.has(h.track_id));

  const findsLabel = "finds";
  const collectionLabel = "collection";

  const ownTabs = [
    { key: "finds" as TabType, label: findsLabel, icon: <Heart className="h-3 w-3" /> },
    { key: "foryou" as TabType, label: "for you", icon: <Sparkle className="h-3 w-3" /> },
    { key: "collection" as TabType, label: collectionLabel, icon: <Library className="h-3 w-3" /> },
    { key: "activity" as TabType, label: "activity", icon: <Bell className="h-3 w-3" />, badge: unseenRecCount > 0 },
  ];
  const otherTabs = [
    { key: "finds" as TabType, label: findsLabel, icon: <Heart className="h-3 w-3" /> },
    { key: "collection" as TabType, label: collectionLabel, icon: <Library className="h-3 w-3" /> },
  ];
  const tabList = isOwnProfile ? ownTabs : otherTabs;

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: `linear-gradient(180deg, #080B1240 0%, hsl(218 32% 5%) 300px)` }}
    >
      <PageHeader
        title={`@${profile.username || "user"}`}
        rightContent={
          isOwnProfile ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQR(true)}
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <QrCode className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowQR(true)}
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <QrCode className="h-5 w-5" />
            </button>
          )
        }
      />

      <main className="mx-auto max-w-feed px-4 py-4 relative">
        {isOwnProfile && moons.length > 0 && (
          <div
            className="absolute inset-x-0 top-0 h-40 pointer-events-none overflow-visible flex justify-center"
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%, black 70%, transparent 100%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40%, black 70%, transparent 100%)",
            }}
          >
            <style>{`
              @keyframes moon-orbit {
                0%   { transform: translate(160px, 0px); }
                12%  { transform: translate(114px, -40px); }
                25%  { transform: translate(0px, -50px); }
                37%  { transform: translate(-114px, -40px); }
                50%  { transform: translate(-160px, 0px); }
                62%  { transform: translate(-114px, 55px); }
                75%  { transform: translate(0px, 70px); }
                87%  { transform: translate(114px, 55px); }
                100% { transform: translate(160px, 0px); }
              }
              @keyframes moon-glow {
                0%, 100% { box-shadow: 0 0 6px 2px var(--moon-color), 0 0 12px 4px var(--moon-color-dim); }
                50% { box-shadow: 0 0 12px 4px var(--moon-color), 0 0 24px 8px var(--moon-color-dim); }
              }
              @media (prefers-reduced-motion: reduce) {
                .moon-el { animation: none !important; }
                .moon-dot { animation: none !important; }
              }
            `}</style>
            <div style={{ position: "absolute", top: 16, width: 0, height: 0 }}>
              {moons.map((m) => (
                <div
                  key={m.id}
                  className="moon-el flex flex-col items-center"
                  style={
                    {
                      position: "absolute",
                      top: m.orbitTopOffset,
                      left: m.orbitLeftOffset,
                      animation: `moon-orbit ${m.orbitDuration}s linear infinite`,
                      animationDelay: `${m.orbitDelay}s`,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="rounded-full moon-dot"
                    style={
                      {
                        position: "relative",
                        width: m.size,
                        height: m.size,
                        backgroundColor: m.color,
                        opacity: 0.75,
                        "--moon-color": m.color,
                        "--moon-color-dim": `${m.color}66`,
                        animation: `moon-glow 2.5s ease-in-out infinite`,
                      } as React.CSSProperties
                    }
                  >
                    {getMoodRing(profile?.current_mood) && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full"
                        style={
                          {
                            inset: -3,
                            background: getMoodRing(profile?.current_mood)?.background,
                            transform: "translate(1px, -1px)",
                            padding: 1,
                            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor",
                            maskComposite: "exclude",
                          } as React.CSSProperties
                        }
                      />
                    )}
                  </div>
                  <span
                    className="text-[8px] mt-0.5 transition-opacity duration-[2000ms]"
                    style={{ color: "#F0EBE3", opacity: moonsFaded ? 0 : 1 }}
                  >
                    @{m.username || "·"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      className="rounded-full bg-card border border-border px-3 py-1 text-sm text-foreground w-32"
                      placeholder="username"
                    />
                    <button onClick={handleSaveUsername} className="text-xs text-primary">
                      save
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">letters, numbers, . _ - only</span>
                </div>
              ) : (
                <button onClick={() => setUsernameEdit(true)} className="text-sm text-primary hover:underline mt-1">
                  add username →
                </button>
              )
            ) : (
              <p className="text-xs text-muted-foreground">@user</p>
            )}
            {profile?.status && (
              <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">"{profile.status}"</p>
            )}
            {profile?.current_mood && getMoodBySlug(profile.current_mood) && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {getMoodBySlug(profile.current_mood)!.emoji} {getMoodBySlug(profile.current_mood)!.label}
              </p>
            )}
            {!isOwnProfile && tasteMatch !== null && (
              <span className="inline-block mt-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {tasteMatch}% taste match
              </span>
            )}
          </div>

          <div className="w-full relative flex items-end justify-center">
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
                  <div>
                    <p className="font-medium text-foreground text-sm">{findsCount}</p>
                    <p className="text-muted-foreground">finds</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{likesCount}</p>
                    <p className="text-muted-foreground">collection</p>
                  </div>
                </>
              )}
            </div>
            {isOwnProfile && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="absolute right-0 bottom-0 flex flex-col items-center hover:opacity-80 transition-opacity"
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${syncing ? "animate-spin" : ""}`} />
                <p className="text-[10px] text-muted-foreground mt-0.5">{syncing ? "..." : "sync"}</p>
                {syncResult ? (
                  <p className="text-[9px] mt-0.5 transition-opacity duration-500" style={{ color: "#4a6a8a" }}>
                    {syncResult}
                  </p>
                ) : profile.last_synced_at ? (
                  <p className="text-[9px] mt-0.5" style={{ color: "#4a6a8a" }}>
                    {(() => {
                      const mins = Math.round((Date.now() - new Date(profile.last_synced_at).getTime()) / 60000);
                      if (mins < 1) return "just now";
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.round(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      return `${Math.round(hrs / 24)}d ago`;
                    })()}
                  </p>
                ) : null}
              </button>
            )}
          </div>
          {!isOwnProfile && <FollowButton targetUserId={profile.id} />}
        </div>

        <div className="mt-4 flex gap-1.5 mb-3 justify-center flex-wrap">
          {tabList.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150 whitespace-nowrap flex items-center gap-1 relative flex-shrink-0 ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
            >
              {"icon" in t && (t as any).icon}
              {t.label}
              {"badge" in t && (t as any).badge && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {!dataLoaded ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
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
                    trackDbId: s.track_id,
                  }}
                  isSaved={isSaved(s.track_id)}
                  onToggleSave={() => toggleSave(s.track_id, s.source_user_id, "finds")}
                  onShare={() => {}}
                  subtitle={
                    <p className="text-[10px] text-muted-foreground">
                      {s.source_context === "trending"
                        ? "from trending"
                        : s.profiles?.username
                          ? `from @${s.profiles.username}`
                          : s.profiles?.display_name
                            ? `from ${s.profiles.display_name}`
                            : "from feed"}
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
        ) : tab === "activity" ? (
          <div className="space-y-1.5">
            {activityLoaded && activity.length === 0 ? (
              <div className="space-y-2">
                <p className="py-3 text-center text-sm text-muted-foreground">
                  when people save or react to your songs, you'll see it here.
                </p>
                <div className="rounded-xl border border-border bg-card p-2.5 opacity-50 relative border-l-4 border-l-primary">
                  <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    example
                  </span>
                  <p className="text-sm text-foreground">
                    @musicfan saved <span className="text-primary">Beautiful Things</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-2.5 opacity-50 relative">
                  <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    example
                  </span>
                  <p className="text-sm text-foreground">
                    @friend reacted 🔥 to <span className="text-primary">Swim</span>
                  </p>
                </div>
              </div>
            ) : !activityLoaded ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              activity.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-xl border border-border bg-card p-2.5 ${item.type === "save" ? "border-l-4 border-l-primary" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {item.type === "recommendation" ? (
                      <Send className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : item.avatarUrl ? (
                      <div className="h-5 w-5 overflow-hidden rounded-full bg-primary/20 flex-shrink-0">
                        <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <p className="text-xs text-foreground flex-1 min-w-0">
                      {item.type === "save" ? (
                        <>
                          <Link to={`/profile/${item.username}`} className="text-primary hover:underline">
                            @{item.username || item.displayName}
                          </Link>
                          {" saved "}
                          <span className="text-primary">{item.trackTitle}</span>
                        </>
                      ) : item.type === "reaction" ? (
                        <>
                          <Link to={`/profile/${item.username}`} className="text-primary hover:underline">
                            @{item.username || item.displayName}
                          </Link>
                          {" reacted "}
                          {item.emoji}
                          {" to "}
                          <span className="text-primary">{item.trackTitle}</span>
                        </>
                      ) : (
                        <>
                          <Link to={`/profile/${item.username}`} className="text-primary hover:underline">
                            @{item.username || item.displayName}
                          </Link>
                          {" recommended "}
                          <span className="text-primary">{item.trackTitle}</span>
                          {" for you"}
                        </>
                      )}
                    </p>
                    {item.type === "recommendation" && item.albumArtUrl && (
                      <div className="h-8 w-8 rounded overflow-hidden flex-shrink-0">
                        <img src={item.albumArtUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === "foryou" ? (
          <div className="space-y-2">
            {recsLoaded && recommendations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                when someone recommends you a song, it'll appear here.
              </p>
            ) : !recsLoaded ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
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
                    trackDbId: rec.track_id,
                  }}
                  isSaved={isSaved(rec.track_id)}
                  onToggleSave={() => toggleSave(rec.track_id)}
                  subtitle={
                    <p className="text-[10px] text-muted-foreground">
                      from @{rec.profiles?.username || rec.profiles?.display_name}
                      {rec.message && <span className="italic"> — "{rec.message}"</span>}
                    </p>
                  }
                />
              ))
            )}
          </div>
        ) : (
          <>
            {/* Collection tab with hidden filter inside */}
            <div className="flex gap-2 mb-3 flex-wrap justify-center">
              <button
                onClick={() => setCollectionFilter("30d")}
                className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-150 ${collectionFilter === "30d" ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}
              >
                last 30 days ({likes.filter((l) => l.liked_at >= thirtyDaysAgo && !collectionExclusionIds.has(l.track_id) && !ownHiddenIds.has(l.track_id)).length}
                )
              </button>
              <button
                onClick={() => setCollectionFilter("all")}
                className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-150 ${collectionFilter === "all" ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}
              >
                all time ({likes.filter((l) => !collectionExclusionIds.has(l.track_id) && !ownHiddenIds.has(l.track_id)).length})
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setCollectionFilter("hidden")}
                  className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-150 ${collectionFilter === "hidden" ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}
                >
                  hidden ({filteredHiddenTracks.length})
                </button>
              )}
            </div>

            {collectionFilter === "hidden" ? (
              !hiddenLoaded ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : filteredHiddenTracks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">no hidden songs</p>
              ) : (
                <div className="space-y-2">
                  {filteredHiddenTracks.map((h: any) => (
                    <div key={h.id}>
                      <UnifiedTrackCard
                        compact
                        hideReactions
                        track={{
                          id: h.id,
                          title: h.tracks?.title || "Unknown",
                          artist: h.tracks?.artist || "Unknown",
                          albumArtUrl: h.tracks?.album_art_url,
                          spotifyTrackId: h.tracks?.spotify_track_id,
                          trackDbId: h.track_id,
                        }}
                        isSaved={isSaved(h.track_id)}
                        onToggleSave={() => toggleSave(h.track_id)}
                      />
                      <div className="flex gap-4 px-3 pt-1 pb-1">
                        <button
                          onClick={() => handleUnhideTrack(h.id)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          unhide
                        </button>
                        <button
                          onClick={() =>
                            setPendingRemoveTrack({
                              hiddenId: h.id,
                              trackId: h.track_id,
                              title: h.tracks?.title,
                            })
                          }
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filteredLikes.length > 0 ? (
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
                      trackDbId: like.track_id,
                    }}
                    isSaved={isSaved(like.track_id)}
                    onToggleSave={() => toggleSave(like.track_id, profile.id, "collection")}
                    sourceUserId={!isOwnProfile ? profile.id : undefined}
                    sourceContext={!isOwnProfile ? "finds" : undefined}
                    onShare={() => {}}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {isOwnProfile ? "your likes will appear here — tap sync to import" : "no tracks yet"}
              </p>
            )}
          </>
        )}

        <div className="mt-12 flex justify-center">
          <button onClick={handleEasterEggTap} className="text-[10px] text-muted-foreground select-none">
            PLAI
          </button>
        </div>
      </main>

      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full mx-4 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                value={`https://onplai.lovable.app/profile/${profile?.username || profile?.id}`}
                size={180}
                bgColor="transparent"
                fgColor="#F0EBE3"
              />
            </div>
            <p className="text-sm text-foreground mb-1">@{profile?.username || "user"}</p>
            <button
              onClick={copyProfileLink}
              className="flex items-center justify-center gap-2 mx-auto rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 mt-3"
            >
              <Copy className="h-4 w-4" /> copy profile link
            </button>
          </div>
        </div>
      )}

      {followModal && profile && (
        <FollowersModal profileId={profile.id} mode={followModal} onClose={() => setFollowModal(null)} />
      )}
      {pendingRemoveTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPendingRemoveTrack(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full mx-4 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPendingRemoveTrack(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-lg font-medium text-foreground">remove from collection?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {pendingRemoveTrack.title ? `"${pendingRemoveTrack.title}" will be removed from your PLAI collection.` : "This song will be removed from your PLAI collection."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">you can still like it again later if you change your mind.</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingRemoveTrack(null)}
                className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:text-foreground"
              >
                cancel
              </button>
              <button
                onClick={() => handleRemoveHiddenTrack(pendingRemoveTrack.hiddenId, pendingRemoveTrack.trackId)}
                className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
              >
                remove
              </button>
            </div>
          </div>
        </div>
      )}
      {showFlappy && <FlappyBird onClose={() => setShowFlappy(false)} />}
      <BottomNav />
    </div>
  );
};

export default Profile;
