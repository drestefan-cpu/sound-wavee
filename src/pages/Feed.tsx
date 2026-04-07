import { useEffect, useState, useCallback, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import BottomNav from "@/components/BottomNav";
import PlaiLogo from "@/components/PlaiLogo";
import HomeTagline from "@/components/HomeTagline";
import UserCard from "@/components/UserCard";
import RecommendModal from "@/components/RecommendModal";
import { Input } from "@/components/ui/input";
import { trendingTracks } from "@/lib/trending";
import { demoFeedItems, demoUsers } from "@/lib/demoData";

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
  const { isSaved, toggleSave } = useSavedTracks();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"following" | "trending" | "people" | "plailists">("following");
  const [isNewUser, setIsNewUser] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [peopleQuery, setPeopleQuery] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [recommendTrack, setRecommendTrack] = useState<{ id: string; title: string } | null>(null);

  // plai picks from DB
  const [plaiPicks, setPlaiPicks] = useState<any[]>([]);
  const [picksLoading, setPicksLoading] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("onboarding_complete").eq("id", user.id).single();
      if (data && !(data as any).onboarding_complete) {
        setIsNewUser(true);
        setShowWelcome(true);
        await supabase.from("profiles").update({ onboarding_complete: true } as any).eq("id", user.id);
        setTimeout(() => setShowWelcome(false), 2000);
      }
    };
    checkOnboarding();
  }, [user]);

  const loadFollowing = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const ids = (data || []).map((f) => f.following_id);
    setFollowingIds(ids);
    return ids;
  }, [user]);

  const loadFeed = useCallback(async (ids?: string[]) => {
    if (!user) return;
    const followIds = ids || followingIds;
    const userIds = [...followIds, user.id];
    const { data, error } = await supabase
      .from("likes")
      .select(`id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)`)
      .in("user_id", userIds)
      .order("liked_at", { ascending: false })
      .limit(50);
    if (error) console.error("Feed error:", error);
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

  const loadPeople = useCallback(async (q?: string) => {
    if (!user) return;
    setPeopleLoading(true);
    let request = supabase.from("profiles").select("*").neq("id", user.id).limit(30);
    if (q && q.trim()) {
      request = request.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }
    const { data } = await request;
    setPeople(data || []);
    setPeopleLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === "people" && people.length === 0 && !peopleLoading) loadPeople();
  }, [tab]);

  // Load plai picks from DB
  useEffect(() => {
    if (tab === "plailists" && plaiPicks.length === 0 && !picksLoading) {
      setPicksLoading(true);
      supabase.from("plai_picks" as any).select("*").eq("active", true).order("position")
        .then(({ data }) => { setPlaiPicks(data || []); setPicksLoading(false); });
    }
  }, [tab]);

  const handlePeopleSearch = (val: string) => {
    setPeopleQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPeople(val), 300);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("feed-likes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, async (payload) => {
        const newLike = payload.new as any;
        if (followingIds.includes(newLike.user_id) || newLike.user_id === user.id) {
          const { data } = await supabase
            .from("likes")
            .select("id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)")
            .eq("id", newLike.id).single();
          if (data) {
            const item = data as unknown as FeedItem;
            setItems((prev) => [item, ...prev]);
            if (newLike.user_id !== user.id) {
              toast(`${item.profiles?.display_name || "Someone"} just liked ${item.tracks?.title} ↗`);
            }
          }
        }
      })
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

  const tabs = [
    { key: "following", label: "following" },
    { key: "trending", label: "trending" },
    { key: "people", label: "people" },
    { key: "plailists", label: "plai·lists" },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <PlaiLogo className="text-xl" />
            <HomeTagline />
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live" />
            Live
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-feed px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-feed px-4 py-4">
        {tab === "following" ? (
          <>
            {!hasFollowing && !hasContent && !feedLoading ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/30 bg-card p-4 text-center">
                  <p className="text-sm text-foreground mb-1">this is what your feed looks like</p>
                  <p className="text-xs text-muted-foreground mb-3">follow friends to see the real thing</p>
                  <button onClick={() => setTab("people")} className="inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80">
                    find friends
                  </button>
                </div>
                {demoFeedItems.map((item) => (
                  <UnifiedTrackCard
                    key={item.id}
                    track={{
                      id: item.id,
                      title: item.track.title,
                      artist: item.track.artist,
                      spotifyTrackId: item.track.spotify_track_id,
                      likeId: item.id,
                      localOnly: true,
                      initialReactions: item.reactions,
                    }}
                    header={
                      <div className="mb-2 flex items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/20">
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                            {item.user.display_name[0].toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">{item.user.display_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{item.time_ago}</span>
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Spotify</span>
                          </div>
                        </div>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : hasContent ? (
              <div className="space-y-3">
                {items.map((item) => {
                  const profile = item.profiles;
                  const track = item.tracks;
                  return (
                    <UnifiedTrackCard
                      key={item.id}
                      track={{
                        id: track?.id,
                        title: track?.title,
                        artist: track?.artist,
                        album: track?.album,
                        albumArtUrl: track?.album_art_url,
                        spotifyTrackId: track?.spotify_track_id,
                        likeId: item.id,
                        trackDbId: item.track_id,
                      }}
                      isSaved={isSaved(item.track_id)}
                      onToggleSave={() => toggleSave(item.track_id, profile?.id, "feed")}
                      onShare={() => setRecommendTrack({ id: item.track_id, title: track?.title })}
                      header={
                        <div className="mb-2 flex items-center gap-3">
                          <Link to={`/profile/${profile?.username || profile?.id}`}>
                            <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/20">
                              {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                                  {(profile?.display_name || "U")[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link to={`/profile/${profile?.username || profile?.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150">
                              {profile?.display_name || "User"}
                            </Link>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  const seconds = Math.floor((Date.now() - new Date(item.liked_at).getTime()) / 1000);
                                  if (seconds < 60) return "just now";
                                  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
                                  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
                                  return `${Math.floor(seconds / 86400)}d ago`;
                                })()}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Spotify</span>
                            </div>
                          </div>
                        </div>
                      }
                    />
                  );
                })}
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
                <button onClick={() => setTab("people")} className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80">
                  find friends
                </button>
              </div>
            )}
          </>
        ) : tab === "trending" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground">trending this week</p>
              <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                WIP — some links may be buggy
              </span>
            </div>
            {trendingTracks.map((track) => {
              const bgColor = track.position % 2 === 1 ? '#FF2D78' : '#1a2535';
              return (
                <UnifiedTrackCard
                  key={track.position}
                  compact
                  hideReactions
                  track={{
                    id: `trending-${track.position}`,
                    title: track.title,
                    artist: track.artist,
                    spotifyTrackId: track.spotifyTrackId,
                    albumArtUrl: track.albumArtUrl || undefined,
                    likeId: `trending-${track.position}`,
                    localOnly: true,
                  }}
                  placeholderColor={bgColor}
                  placeholderText={String(track.position)}
                  onShare={() => {
                    if (navigator.share) {
                      navigator.share({ title: track.title, url: `https://open.spotify.com/track/${track.spotifyTrackId}` });
                    } else {
                      navigator.clipboard.writeText(`https://open.spotify.com/track/${track.spotifyTrackId}`);
                      toast("link copied");
                    }
                  }}
                  subtitle={
                    <span className="text-[10px] text-muted-foreground">#{track.position}</span>
                  }
                />
              );
            })}
          </div>
        ) : tab === "people" ? (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={peopleQuery} onChange={(e) => handlePeopleSearch(e.target.value)} placeholder="search users..." className="bg-card border-border pl-10" />
            </div>
            {peopleLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-2">
                {people.map((u) => <UserCard key={u.id} profile={u} showFollow />)}
                {people.length === 0 && !peopleQuery && demoUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 relative">
                    <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-primary">example</span>
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20">
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">{u.display_name[0].toUpperCase()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{u.username} · {u.genre}</p>
                    </div>
                  </div>
                ))}
                {people.length === 0 && peopleQuery && (
                  <p className="py-12 text-center text-sm text-muted-foreground">no users found</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div>
                <h3 className="font-display text-lg text-foreground">PLAI picks</h3>
                <p className="text-xs text-muted-foreground">curated by @plai</p>
              </div>
              <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                WIP — curated picks, more coming soon
              </span>
            </div>
            <div className="space-y-2">
              {picksLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : plaiPicks.length > 0 ? (
                plaiPicks.map((pick: any, i: number) => (
                  <UnifiedTrackCard
                    key={pick.id}
                    compact
                    hideReactions
                    track={{
                      id: `plai-${pick.id}`,
                      title: pick.title,
                      artist: pick.artist,
                      spotifyTrackId: pick.spotify_track_id,
                      albumArtUrl: pick.album_art_url,
                    }}
                    onShare={() => {
                      if (pick.spotify_track_id) {
                        const url = `https://open.spotify.com/track/${pick.spotify_track_id}`;
                        if (navigator.share) navigator.share({ title: pick.title, url });
                        else { navigator.clipboard.writeText(url); toast("link copied"); }
                      }
                    }}
                    subtitle={
                      <span className="text-[10px] text-muted-foreground">
                        #{pick.position}{pick.note ? ` · ${pick.note}` : ""}
                      </span>
                    }
                  />
                ))
              ) : (
                // Fallback to hardcoded trending
                trendingTracks.slice(0, 10).map((track, i) => (
                  <UnifiedTrackCard
                    key={track.position}
                    compact
                    hideReactions
                    track={{
                      id: `plai-${track.position}`,
                      title: track.title,
                      artist: track.artist,
                      spotifyTrackId: track.spotifyTrackId,
                      albumArtUrl: track.albumArtUrl,
                    }}
                    subtitle={<span className="text-[10px] text-muted-foreground">#{i + 1}</span>}
                  />
                ))
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <span className="inline-block rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground mb-2">coming soon</span>
              <p className="text-sm text-foreground">your plai·lists</p>
              <p className="text-xs text-muted-foreground mt-1">create and share your own · coming soon</p>
            </div>
          </div>
        )}
      </main>

      {recommendTrack && (
        <RecommendModal trackId={recommendTrack.id} trackTitle={recommendTrack.title} onClose={() => setRecommendTrack(null)} />
      )}

      <BottomNav />
    </div>
  );
};

export default Feed;
