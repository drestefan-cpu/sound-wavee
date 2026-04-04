import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Music, Users } from "lucide-react";
import { toast } from "sonner";
import TrackCard from "@/components/TrackCard";
import BottomNav from "@/components/BottomNav";

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
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const loadFollowing = useCallback(async () => {
    if (!user) return;
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
    setLoading(false);
  }, [user, followingIds]);

  useEffect(() => {
    const init = async () => {
      const ids = await loadFollowing();
      await loadFeed(ids);
    };
    init();
  }, [user]);

  // Realtime subscription for new likes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("feed-likes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes" },
        async (payload) => {
          const newLike = payload.new as any;
          if (
            followingIds.includes(newLike.user_id) ||
            newLike.user_id === user.id
          ) {
            // Fetch full data for the new like
            const { data } = await supabase
              .from("likes")
              .select("*, profiles(*), tracks(*)")
              .eq("id", newLike.id)
              .single();

            if (data) {
              const item = data as unknown as FeedItem;
              setItems((prev) => [item, ...prev]);
              if (newLike.user_id !== user.id) {
                toast(`${item.profiles?.display_name || "Someone"} just liked ${item.tracks?.title}`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, followingIds]);

  if (loading) {
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
          <h1 className="font-display text-xl font-bold">Soundwave</h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live" />
              Live
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-feed px-4 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Your feed is empty</h2>
            <p className="text-sm text-muted-foreground">
              Follow some friends to see what they're listening to
            </p>
            <Link
              to="/discover"
              className="mt-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Find friends
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <TrackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Feed;
