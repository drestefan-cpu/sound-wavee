import { useEffect, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TrackCard from "@/components/TrackCard";
import TrendingCard from "@/components/TrendingCard";
import DemoCard from "@/components/DemoCard";
import BottomNav from "@/components/BottomNav";
import PlaiLogo from "@/components/PlaiLogo";
import { trendingTracks } from "@/lib/trending";
import { demoFeedItems } from "@/lib/demoData";

interface FeedItem {
  id: string;
  liked_at: string;
  user_id: string;
  track_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  tracks: {
    id: string;
    spotify_track_id: string;
    title: string;
    artist: string;
    album: string | null;
    album_art_url: string | null;
    preview_url: string | null;
  };
}

const Feed = () => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"following" | "trending">("following");
  const [isNewUser, setIsNewUser] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .single();
      if (data && !(data as any).onboarding_complete) {
        setIsNewUser(true);
        setShowWelcome(true);
        // Mark as complete and auto-advance
        await supabase.from("profiles").update({ onboarding_complete: true } as any).eq("id", user.id);
        setTimeout(() => setShowWelcome(false), 2000);
      }
    };
    checkOnboarding();
  }, [user]);

  const loadFollowing = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const ids = (data || []).map((f) => f.following_id);
    setFollowingIds(ids);
    return ids;
  }, [user]);

  const loadFeed = useCallback(async (ids?: string[]) => {
    if (!user) return;
    const followIds = ids || followingIds;
    const userIds = [...followIds, user.id];

    const { data } = await supabase
      .from("likes")
      .select("*, profiles(*), tracks(*)")
      .in("user_id", userIds)
      .order("liked_at", { ascending: false })
      .limit(50);

    setItems((data as unknown as FeedItem[]) || []);
    setFeedLoading(false);
  }, [user, followingIds]);

  useEffect(() => {
    const init = async () => {
      const ids = await loadFollowing();
      await loadFeed(ids);
    };
    init();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("feed-likes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes" },
        async (payload) => {
          const newLike = payload.new as any;
          if (followingIds.includes(newLike.user_id) || newLike.user_id === user.id) {
            const { data } = await supabase
              .from("likes")
              .select("*, profiles(*), tracks(*)")
              .eq("id", newLike.id)
              .single();
            if (data) {
              const item = data as unknown as FeedItem;
              setItems((prev) => [item, ...prev]);
              if (newLike.user_id !== user.id) {
                toast(`${item.profiles?.display_name || "Someone"} just liked ${item.tracks?.title} ↗`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, followingIds]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (showWelcome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <PlaiLogo className="text-6xl" />
        <p className="text-lg font-light text-foreground">welcome to PLAI</p>
      </div>
    );
  }

  const hasFollowing = followingIds.length > 0;
  const hasContent = items.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <PlaiLogo className="text-xl" />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live" />
            Live
          </span>
        </div>
      </header>


      {/* Tabs */}
      <div className="mx-auto max-w-feed px-4 pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("following")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "following"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            following
          </button>
          <button
            onClick={() => setTab("trending")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              tab === "trending"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            trending
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-feed px-4 py-4">
        {tab === "following" ? (
          <>
            {!hasFollowing && !hasContent && !feedLoading ? (
              <div className="space-y-3">
                {/* Banner */}
                <div className="rounded-xl border border-primary/30 bg-card p-4 text-center">
                  <p className="text-sm text-foreground mb-1">this is what your feed looks like</p>
                  <p className="text-xs text-muted-foreground mb-3">follow friends to see the real thing</p>
                  <Link
                    to="/discover"
                    className="inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                  >
                    find friends
                  </Link>
                </div>
                {demoFeedItems.map((item) => (
                  <DemoCard key={item.id} item={item} />
                ))}
              </div>
            ) : hasContent ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <TrackCard key={item.id} item={item} />
                ))}
              </div>
            ) : feedLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <PlaiLogo className="text-2xl" />
                <h2 className="text-lg font-medium text-foreground">your feed is quiet</h2>
                <p className="text-sm text-muted-foreground">follow some friends to hear what they're loving</p>
                <Link
                  to="/discover"
                  className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                >
                  find friends
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-2">trending this week</p>
            {trendingTracks.map((track) => (
              <TrendingCard key={track.position} track={track} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Feed;
