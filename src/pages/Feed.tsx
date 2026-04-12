import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import BottomNav from "@/components/BottomNav";
import PlaiLogo from "@/components/PlaiLogo";
import HomeTagline, { HomeTaglineRef } from "@/components/HomeTagline";
import UserCard from "@/components/UserCard";
import RecommendModal from "@/components/RecommendModal";
import { Input } from "@/components/ui/input";
import { trendingTracks } from "@/lib/trending";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
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

let cachedFeedItems: FeedItem[] | null = null;
let cachedHiddenTrackIds: string[] | null = null;
let cachedCollectionExclusionIds: string[] | null = null;

interface ArtistReleaseItem {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  spotifyTrackId: string;
  albumArtUrl: string | null;
  trackDbId?: string;
  badge?: "today" | "new";
  likedBy?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }[];
}

type LiveState = "live" | "new" | "syncing";

const artistReleaseFallbackItems: ArtistReleaseItem[] = [
  {
    id: "artist-release-1",
    title: trendingTracks[0].title,
    artist: trendingTracks[0].artist,
    album: "SWIM - Single",
    spotifyTrackId: trendingTracks[0].spotifyTrackId,
    albumArtUrl: trendingTracks[0].albumArtUrl,
    badge: "today",
    likedBy: [
      { id: demoUsers[0].id, username: demoUsers[0].username, displayName: demoUsers[0].display_name, avatarUrl: null },
      { id: demoUsers[2].id, username: demoUsers[2].username, displayName: demoUsers[2].display_name, avatarUrl: null },
    ],
  },
  {
    id: "artist-release-2",
    title: trendingTracks[2].title,
    artist: trendingTracks[2].artist,
    album: "Live at the Jazz Cafe",
    spotifyTrackId: trendingTracks[2].spotifyTrackId,
    albumArtUrl: trendingTracks[2].albumArtUrl,
    badge: "today",
    likedBy: [
      { id: demoUsers[1].id, username: demoUsers[1].username, displayName: demoUsers[1].display_name, avatarUrl: null },
    ],
  },
  {
    id: "artist-release-3",
    title: trendingTracks[4].title,
    artist: trendingTracks[4].artist,
    album: "Ordinary EP",
    spotifyTrackId: trendingTracks[4].spotifyTrackId,
    albumArtUrl: trendingTracks[4].albumArtUrl,
    badge: "new",
    likedBy: [
      { id: demoUsers[0].id, username: demoUsers[0].username, displayName: demoUsers[0].display_name, avatarUrl: null },
      { id: demoUsers[3].id, username: demoUsers[3].username, displayName: demoUsers[3].display_name, avatarUrl: null },
      { id: demoUsers[4].id, username: demoUsers[4].username, displayName: demoUsers[4].display_name, avatarUrl: null },
      { id: demoUsers[5].id, username: demoUsers[5].username, displayName: demoUsers[5].display_name, avatarUrl: null },
    ],
  },
  {
    id: "artist-release-4",
    title: trendingTracks[6].title,
    artist: trendingTracks[6].artist,
    album: "GNX",
    spotifyTrackId: trendingTracks[6].spotifyTrackId,
    albumArtUrl: trendingTracks[6].albumArtUrl,
    badge: "new",
    likedBy: [
      { id: demoUsers[2].id, username: demoUsers[2].username, displayName: demoUsers[2].display_name, avatarUrl: null },
      { id: demoUsers[4].id, username: demoUsers[4].username, displayName: demoUsers[4].display_name, avatarUrl: null },
    ],
  },
  {
    id: "artist-release-5",
    title: trendingTracks[8].title,
    artist: trendingTracks[8].artist,
    album: "rosie",
    spotifyTrackId: trendingTracks[8].spotifyTrackId,
    albumArtUrl: trendingTracks[8].albumArtUrl,
    likedBy: [
      { id: demoUsers[3].id, username: demoUsers[3].username, displayName: demoUsers[3].display_name, avatarUrl: null },
    ],
  },
  {
    id: "artist-release-6",
    title: trendingTracks[10].title,
    artist: trendingTracks[10].artist,
    album: "I've Tried Everything But Therapy (Part 1)",
    spotifyTrackId: trendingTracks[10].spotifyTrackId,
    albumArtUrl: trendingTracks[10].albumArtUrl,
  },
  {
    id: "artist-release-7",
    title: trendingTracks[12].title,
    artist: trendingTracks[12].artist,
    album: "I'm the Problem",
    spotifyTrackId: trendingTracks[12].spotifyTrackId,
    albumArtUrl: trendingTracks[12].albumArtUrl,
  },
];

const USE_MOCK_ARTIST_TAB = true;

const normalizeArtistName = (value?: string | null) =>
  value
    ?.normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() || "";

const getArtistBadge = (releaseDate?: string | null): ArtistReleaseItem["badge"] => {
  if (!releaseDate) return undefined;
  const today = new Date();
  const release = new Date(releaseDate);
  const diffDays = Math.floor((today.getTime() - release.getTime()) / 86400000);
  if (diffDays <= 1) return "today";
  if (diffDays <= 7) return "new";
  return undefined;
};

// Log search queries silently
const logSearchQuery = async (userId: string, query: string, resultsCount: number) => {
  if (!userId || !query.trim()) return;
  try {
    await (supabase.from("search_queries" as any).insert({
      user_id: userId,
      query: query.trim(),
      results_count: resultsCount,
    }) as any);
  } catch {}
};

const Feed = () => {
  const { user, loading } = useAuth();
  const { isSaved, toggleSave } = useSavedTracks();
  const [items, setItems] = useState<FeedItem[]>(() => cachedFeedItems || []);
  const [pendingItems, setPendingItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(() => cachedFeedItems === null);
  const [filtersReady, setFiltersReady] = useState(
    () => cachedHiddenTrackIds !== null && cachedCollectionExclusionIds !== null,
  );
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"following" | "artists" | "trending" | "people" | "plailists">("following");
  const [showWelcome, setShowWelcome] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("live");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(cachedHiddenTrackIds || []));
  const [collectionExclusionIds, setCollectionExclusionIds] = useState<Set<string>>(
    () => new Set(cachedCollectionExclusionIds || []),
  );

  const [peopleQuery, setPeopleQuery] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const taglineRef = useRef<HomeTaglineRef>(null);
  const [logoFlash, setLogoFlash] = useState(false);
  const [recommendTrack, setRecommendTrack] = useState<{ id: string; title: string } | null>(null);

  const [plaiPicks, setPlaiPicks] = useState<any[]>([]);
  const [picksLoading, setPicksLoading] = useState(false);
  const [artistItems, setArtistItems] = useState<ArtistReleaseItem[]>(artistReleaseFallbackItems);
  const [artistLoading, setArtistLoading] = useState(true);
  const [artistFallback, setArtistFallback] = useState(false);
  const [artistEmptyState, setArtistEmptyState] = useState<"no-followed-artists" | "no-releases" | null>(null);
  const [artistFollowedCount, setArtistFollowedCount] = useState(0);
  const [artistMatchedCount, setArtistMatchedCount] = useState(0);
  const [artistHasTestRelease, setArtistHasTestRelease] = useState(false);
  const [artistFollowedDebug, setArtistFollowedDebug] = useState<{ raw: string; normalized: string }[]>([]);
  const [artistReleaseDebug, setArtistReleaseDebug] = useState<{ raw: string; normalized: string }[]>([]);
  const [artistHasDestinFollowed, setArtistHasDestinFollowed] = useState(false);
  const [artistHasDestinRelease, setArtistHasDestinRelease] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("onboarding_complete").eq("id", user.id).single();
      if (data && !(data as any).onboarding_complete) {
        setShowWelcome(true);
        await supabase
          .from("profiles")
          .update({ onboarding_complete: true } as any)
          .eq("id", user.id);
        setTimeout(() => setShowWelcome(false), 2000);
      }
    };
    checkOnboarding();
  }, [user, followingIds]);

  const loadFollowing = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const ids = (data || []).map((f) => f.following_id);
    setFollowingIds(ids);
    return ids;
  }, [user]);

  const loadFeed = useCallback(
    async (ids?: string[]) => {
      if (!user) return;
      const followIds = ids || followingIds;
      const userIds = [...followIds, user.id];
      const { data, error } = await supabase
        .from("likes")
        .select(
          `id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)`,
        )
        .in("user_id", userIds)
        .order("liked_at", { ascending: false })
        .limit(50);
      if (error) console.error("Feed error:", error);
      const nextItems = (data as unknown as FeedItem[]) || [];
      const actorIds = [...new Set(nextItems.map((item) => item.user_id).filter(Boolean))];
      const trackIds = [...new Set(nextItems.map((item) => item.track_id).filter(Boolean))];

      let visibleItems = nextItems;
      if (actorIds.length > 0 && trackIds.length > 0) {
        const [{ data: hiddenRows }, { data: exclusionRows }] = await Promise.all([
          supabase
            .from("hidden_tracks" as any)
            .select("user_id, track_id")
            .in("user_id", actorIds)
            .in("track_id", trackIds) as any,
          supabase
            .from("collection_exclusions" as any)
            .select("user_id, track_id")
            .in("user_id", actorIds)
            .in("track_id", trackIds) as any,
        ]);

        const hiddenLookup = new Set(
          ((hiddenRows || []) as any[]).map((row: any) => `${row.user_id}:${row.track_id}`),
        );
        const exclusionLookup = new Set(
          ((exclusionRows || []) as any[]).map((row: any) => `${row.user_id}:${row.track_id}`),
        );

        visibleItems = nextItems.filter(
          (item) =>
            !hiddenLookup.has(`${item.user_id}:${item.track_id}`) &&
            !exclusionLookup.has(`${item.user_id}:${item.track_id}`),
        );
      }

      cachedFeedItems = visibleItems;
      setItems(visibleItems);
      setFeedLoading(false);
    },
    [user, followingIds],
  );

  useEffect(() => {
    const init = async () => {
      const hasCachedFeed = cachedFeedItems !== null;
      const hasCachedFilters = cachedHiddenTrackIds !== null && cachedCollectionExclusionIds !== null;
      if (!hasCachedFeed) setFeedLoading(true);
      if (!hasCachedFilters) setFiltersReady(false);
      try {
        const ids = await loadFollowing();
        const feedPromise = loadFeed(ids);
        if (user) {
          const filtersPromise = Promise.all([
            supabase
              .from("hidden_tracks" as any)
              .select("track_id")
              .eq("user_id", user.id),
            supabase.from("collection_exclusions" as any).select("track_id").eq("user_id", user.id),
          ]).then(([hiddenRes, exclusionsRes]) => {
            const nextHiddenIds = ((hiddenRes.data || []) as any[]).map((r: any) => r.track_id);
            const nextExclusionIds = ((exclusionsRes.data || []) as any[]).map((r: any) => r.track_id);
            cachedHiddenTrackIds = nextHiddenIds;
            cachedCollectionExclusionIds = nextExclusionIds;
            setHiddenIds(new Set(nextHiddenIds));
            setCollectionExclusionIds(new Set(nextExclusionIds));
          });
          await Promise.all([feedPromise, filtersPromise]);
        } else {
          await feedPromise;
        }
      } finally {
        setFiltersReady(true);
      }
    };
    init();
  }, [user]);

  const loadPeople = useCallback(
    async (q?: string) => {
      if (!user) return;
      setPeopleLoading(true);
      let request = supabase.from("profiles").select("*").neq("id", user.id).limit(30);
      if (q && q.trim()) request = request.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      const { data } = await request;
      setPeople(data || []);
      setPeopleLoading(false);
      return data || [];
    },
    [user],
  );

  useEffect(() => {
    if (tab === "people" && people.length === 0 && !peopleLoading) loadPeople();
  }, [tab]);

  useEffect(() => {
    if (tab === "plailists" && plaiPicks.length === 0 && !picksLoading) {
      setPicksLoading(true);
      supabase
        .from("plai_picks" as any)
        .select("*")
        .eq("active", true)
        .order("position")
        .then(({ data }) => {
          setPlaiPicks(data || []);
          setPicksLoading(false);
        });
    }
  }, [tab]);

  useEffect(() => {
    const loadArtistReleases = async () => {
      if (!user) return;

      if (USE_MOCK_ARTIST_TAB) {
        setArtistItems(artistReleaseFallbackItems);
        setArtistLoading(false);
        setArtistFallback(false);
        setArtistEmptyState(null);
        setArtistFollowedCount(artistReleaseFallbackItems.length);
        setArtistMatchedCount(artistReleaseFallbackItems.length);
        setArtistHasTestRelease(false);
        setArtistFollowedDebug([]);
        setArtistReleaseDebug([]);
        setArtistHasDestinFollowed(false);
        setArtistHasDestinRelease(false);
        return;
      }

      setArtistLoading(true);
      setArtistEmptyState(null);
      setArtistFallback(false);
      setArtistFollowedCount(0);
      setArtistMatchedCount(0);
      setArtistHasTestRelease(false);
      setArtistFollowedDebug([]);
      setArtistReleaseDebug([]);
      setArtistHasDestinFollowed(false);
      setArtistHasDestinRelease(false);

      try {
        const { data: followedRows, error: followedError } = await (supabase
          .from("user_followed_artists" as any)
          .select("artist_name")
          .eq("user_id", user.id) as any);

        if (followedError) throw followedError;

        const followedRawNames = ((followedRows || []) as any[])
          .map((row: any) => row.artist_name)
          .filter((value: any) => typeof value === "string" && value.trim().length > 0);
        setArtistFollowedDebug(
          followedRawNames.slice(0, 5).map((name: string) => ({
            raw: name,
            normalized: normalizeArtistName(name),
          })),
        );

        const followedNames = [...new Set(followedRawNames.map((name: string) => normalizeArtistName(name)).filter(Boolean))];
        setArtistFollowedCount(followedNames.length);
        setArtistHasDestinFollowed(followedNames.includes(normalizeArtistName("DESTIN CONRAD")));

        if (followedNames.length === 0) {
          setArtistItems([]);
          setArtistEmptyState("no-followed-artists");
          setArtistLoading(false);
          return;
        }

        const { data: releaseRows, error: releaseError } = await (supabase
          .from("artist_releases" as any)
          .select("*")
          .order("release_date", { ascending: false }) as any);

        if (releaseError) throw releaseError;

        const releaseArtistNames = ((releaseRows || []) as any[])
          .map((row: any) => row.artist_name)
          .filter((value: any) => typeof value === "string" && value.trim().length > 0);
        setArtistReleaseDebug(
          releaseArtistNames.slice(0, 5).map((name: string) => ({
            raw: name,
            normalized: normalizeArtistName(name),
          })),
        );
        setArtistHasDestinRelease(
          releaseArtistNames.some((name: string) => normalizeArtistName(name) === normalizeArtistName("DESTIN CONRAD")),
        );

        const releaseSpotifyIds = [...new Set(((releaseRows || []) as any[])
          .map((row: any) => row.spotify_track_id)
          .filter(Boolean))];

        const trackIdBySpotifyId = new Map<string, string>();
        if (releaseSpotifyIds.length > 0) {
          const { data: trackRows } = await (supabase
            .from("tracks")
            .select("id, spotify_track_id")
            .in("spotify_track_id", releaseSpotifyIds) as any);

          ((trackRows || []) as any[]).forEach((trackRow) => {
            if (trackRow.spotify_track_id && trackRow.id) {
              trackIdBySpotifyId.set(trackRow.spotify_track_id, trackRow.id);
            }
          });
        }

        const likedByTrackId = new Map<
          string,
          {
            id: string;
            username: string;
            displayName: string;
            avatarUrl: string | null;
          }[]
        >();

        if (followingIds.length > 0) {
          const matchedTrackIds = [...new Set(Array.from(trackIdBySpotifyId.values()).filter(Boolean))];
          if (matchedTrackIds.length > 0) {
            const { data: likeRows } = await (supabase
              .from("likes" as any)
              .select(
                "track_id, user_id, profiles!likes_user_id_fkey(id, username, display_name, avatar_url)",
              )
              .in("user_id", followingIds)
              .in("track_id", matchedTrackIds) as any);

            ((likeRows || []) as any[]).forEach((row) => {
              const profile = row.profiles;
              if (!row.track_id || !profile?.id) return;
              const existing = likedByTrackId.get(row.track_id) || [];
              if (existing.some((friend) => friend.id === profile.id)) return;
              likedByTrackId.set(row.track_id, [
                ...existing,
                {
                  id: profile.id,
                  username: profile.username || "user",
                  displayName: profile.display_name || profile.username || "User",
                  avatarUrl: profile.avatar_url || null,
                },
              ]);
            });
          }
        }

        const matched = ((releaseRows || []) as any[])
          .filter((row) => followedNames.includes(normalizeArtistName(row.artist_name)))
          .map((row) => ({
            id: row.id,
            title: row.title,
            artist: row.artist_name,
            album: row.album,
            spotifyTrackId: row.spotify_track_id,
            albumArtUrl: row.album_art_url,
            trackDbId: trackIdBySpotifyId.get(row.spotify_track_id),
            badge: getArtistBadge(row.release_date),
            likedBy: likedByTrackId.get(trackIdBySpotifyId.get(row.spotify_track_id) || "") || undefined,
          })) as ArtistReleaseItem[];
        setArtistMatchedCount(matched.length);
        setArtistHasTestRelease(matched.some((row) => row.title === "New Drop (Test)"));

        if (matched.length === 0) {
          setArtistItems([]);
          setArtistEmptyState("no-releases");
          setArtistLoading(false);
          return;
        }

        setArtistItems(matched);
        setArtistLoading(false);
      } catch {
        setArtistItems(artistReleaseFallbackItems);
        setArtistFallback(true);
        setArtistMatchedCount(0);
        setArtistHasTestRelease(false);
        setArtistReleaseDebug([]);
        setArtistHasDestinRelease(false);
        setArtistLoading(false);
      }
    };

    loadArtistReleases();
  }, [user]);

  const handlePeopleSearch = (val: string) => {
    setPeopleQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await loadPeople(val);
      if (val.trim() && user?.id) {
        logSearchQuery(user.id, val, results?.length ?? 0);
      }
    }, 300);
  };

  const flushPending = useCallback(() => {
    if (pendingItems.length > 0) {
      setItems((prev) => {
        const nextItems = [...pendingItems, ...prev];
        cachedFeedItems = nextItems;
        return nextItems;
      });
      setPendingItems([]);
    }
    setLiveState("live");
  }, [pendingItems]);

  const handleLiveTap = async () => {
    if (liveState === "new") {
      flushPending();
      return;
    }
    if (liveState === "syncing") return;
    setLiveState("syncing");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("sync-spotify-likes", {
        body: { user_id: user?.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const ids = await loadFollowing();
      await loadFeed(ids);
      setLiveState("live");
    } catch {
      toast.error("sync failed — try again");
      setLiveState("live");
    }
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
            .select(
              "id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, preview_url)",
            )
            .eq("id", newLike.id)
            .single();
          if (data) {
            const item = data as unknown as FeedItem;
            setPendingItems((prev) => [item, ...prev]);
            setLiveState("new");
          }
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
        const deletedLike = payload.old as any;
        setItems((prev) => {
          const nextItems = prev.filter((item) => item.id !== deletedLike.id);
          cachedFeedItems = nextItems;
          return nextItems;
        });
        setPendingItems((prev) => prev.filter((item) => item.id !== deletedLike.id));
        cachedFeedItems = (cachedFeedItems || []).filter((item) => item.id !== deletedLike.id);
      })
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
  if (!user) return <Navigate to="/" replace />;

  if (showWelcome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <PlaiLogo className="text-6xl" />
        <p className="text-lg font-light text-foreground">welcome to PLAI</p>
      </div>
    );
  }

  const handlePullRefresh = useCallback(async () => {
    const ids = await loadFollowing();
    await loadFeed(ids);
    // Clear caches so filters reload
    cachedHiddenTrackIds = null;
    cachedCollectionExclusionIds = null;
    if (user) {
      const [hiddenRes, exclusionsRes] = await Promise.all([
        supabase.from("hidden_tracks" as any).select("track_id").eq("user_id", user.id),
        supabase.from("collection_exclusions" as any).select("track_id").eq("user_id", user.id),
      ]);
      const nextHiddenIds = ((hiddenRes.data || []) as any[]).map((r: any) => r.track_id);
      const nextExclusionIds = ((exclusionsRes.data || []) as any[]).map((r: any) => r.track_id);
      cachedHiddenTrackIds = nextHiddenIds;
      cachedCollectionExclusionIds = nextExclusionIds;
      setHiddenIds(new Set(nextHiddenIds));
      setCollectionExclusionIds(new Set(nextExclusionIds));
    }
  }, [user, loadFollowing, loadFeed]);

  const pullToRefresh = usePullToRefresh({ onRefresh: handlePullRefresh });

  const hasFollowing = followingIds.length > 0;
  const visibleFeedItems = items.filter((item) => !hiddenIds.has(item.track_id) && !collectionExclusionIds.has(item.track_id));
  const hasContent = visibleFeedItems.length > 0;
  const showFeedLoading = feedLoading || !filtersReady;
  const showInitialFeedLoading = showFeedLoading && !(items.length > 0 && filtersReady);

  const tabs = [
    { key: "following", label: "friends" },
    { key: "artists", label: "artists" },
    { key: "people", label: "people" },
  ] as const;

  const renderArtistBadge = (badge?: ArtistReleaseItem["badge"]) => {
    if (!badge) return null;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
          badge === "today"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {badge}
      </span>
    );
  };

  const renderLikedBy = (likedBy?: ArtistReleaseItem["likedBy"]) => {
    if (!likedBy || likedBy.length === 0) return null;
    const visible = likedBy.slice(0, 3);
    const overflow = likedBy.length - visible.length;
    const lead = visible[0];
    return (
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center">
          {visible.map((friend, index) => (
            <div
              key={friend.id}
              className="-ml-1 first:ml-0 h-5 w-5 overflow-hidden rounded-full border border-background bg-primary/20"
              style={{ zIndex: visible.length - index }}
            >
              {friend.avatarUrl ? (
                <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-primary">
                  {friend.displayName[0]?.toUpperCase() || friend.username[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div className="-ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-card px-1 text-[9px] font-medium text-muted-foreground">
              +{overflow}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          liked by @{lead.username}
          {likedBy.length > 1 ? ` +${likedBy.length - 1}` : ""}
        </p>
      </div>
    );
  };

  const artistHighlights = artistItems.slice(0, 3);
  const artistReleases = artistItems;

  const artistSections = [
    {
      key: "popular",
      title: "Popular releases",
      subtitle: "music your friends are loving",
      items: artistHighlights,
      compact: false,
    },
    {
      key: "all",
      title: "All releases",
      subtitle: "Latest drops from the artists you follow",
      items: artistReleases,
      compact: true,
    },
  ] as const;

  const LiveIndicator = () => {
    if (liveState === "syncing") {
      return (
        <button
          onClick={handleLiveTap}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live opacity-50" />
          <span style={{ color: "#4a6a8a" }}>syncing...</span>
        </button>
      );
    }
    if (liveState === "new") {
      return (
        <button
          onClick={handleLiveTap}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex items-center gap-1.5 text-xs transition-all duration-200"
        >
          <span className="h-2 w-2 rounded-full animate-pulse-live" style={{ backgroundColor: "#F0EBE3" }} />
          <span style={{ color: "#F0EBE3", fontWeight: 500 }}>{pendingItems.length} new</span>
        </button>
      );
    }
    return (
      <button
        onClick={handleLiveTap}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live" />
        Live
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <div
              onClick={() => {
                taglineRef.current?.cycle();
                setLogoFlash(true);
                setTimeout(() => setLogoFlash(false), 150);
              }}
              style={{
                cursor: "pointer",
                userSelect: "none",
                display: "inline-block",
                borderRadius: 4,
                background: logoFlash ? "rgba(255,45,120,0.15)" : "transparent",
                transition: "background 0.15s ease",
                padding: "1px 2px",
              }}
            >
              <PlaiLogo className="text-xl" />
            </div>
            <HomeTagline ref={taglineRef} />
          </div>
          <LiveIndicator />
        </div>
      </header>

      <div className="mx-auto max-w-feed px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 whitespace-nowrap ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-feed px-4 py-4">
        {tab === "following" ? (
          <>
            {!hasFollowing && !hasContent && !showInitialFeedLoading ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/30 bg-card p-4 text-center">
                  <p className="text-sm text-foreground mb-1">this is what your feed looks like</p>
                  <p className="text-xs text-muted-foreground mb-3">follow friends to see the real thing</p>
                  <button
                    onClick={() => setTab("people")}
                    className="inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                  >
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
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              music
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : hasContent ? (
              <div className="space-y-3">
                {visibleFeedItems.map((item) => {
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
                        sourceUserId={item.user_id}
                        onHide={() =>
                          setHiddenIds((prev) => {
                            const next = new Set(prev);
                            next.add(item.track_id);
                            cachedHiddenTrackIds = Array.from(next);
                            return next;
                          })
                        }
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
                              <Link
                                to={`/profile/${profile?.username || profile?.id}`}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150"
                              >
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
                                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {track?.spotify_track_id?.startsWith("yt:") ? "YouTube Music" : "Spotify"}
                                </span>
                              </div>
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
              </div>
            ) : showInitialFeedLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <PlaiLogo className="text-2xl" />
                <h2 className="text-lg font-medium text-foreground">your feed is quiet</h2>
                <p className="text-sm text-muted-foreground">follow some friends to hear what they're loving</p>
                <button
                  onClick={() => setTab("people")}
                  className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                >
                  find friends
                </button>
              </div>
            )}
          </>
        ) : tab === "artists" ? (
          <div className="space-y-6">
            {!USE_MOCK_ARTIST_TAB && (
              <>
                <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  <div>user: {user.id}</div>
                  <div>followed artists: {artistFollowedCount}</div>
                  <div>matched releases: {artistMatchedCount}</div>
                  <div>popular releases: {artistItems.slice(0, 3).length}</div>
                  <div>has "New Drop (Test)": {artistHasTestRelease ? "yes" : "no"}</div>
                </div>
                <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground space-y-2">
                  <div>
                    <div className="font-medium text-foreground">followed artists debug</div>
                    {artistFollowedDebug.length > 0 ? (
                      artistFollowedDebug.map((item, index) => (
                        <div key={`followed-${index}`}>
                          raw: "{item.raw}" {"->"} normalized: "{item.normalized}"
                        </div>
                      ))
                    ) : (
                      <div>none</div>
                    )}
                    <div>has DESTIN CONRAD in followed list: {artistHasDestinFollowed ? "yes" : "no"}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">release artists debug</div>
                    {artistReleaseDebug.length > 0 ? (
                      artistReleaseDebug.map((item, index) => (
                        <div key={`release-${index}`}>
                          raw: "{item.raw}" {"->"} normalized: "{item.normalized}"
                        </div>
                      ))
                    ) : (
                      <div>none</div>
                    )}
                    <div>has DESTIN CONRAD in releases list: {artistHasDestinRelease ? "yes" : "no"}</div>
                  </div>
                </div>
              </>
            )}
            {artistLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : artistEmptyState === "no-followed-artists" ? (
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <h3 className="text-sm font-medium text-foreground">Follow more artists to build this feed</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your Artists tab will fill in as you save and share tracks by artists you love.
                </p>
              </div>
            ) : artistEmptyState === "no-releases" ? (
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <h3 className="text-sm font-medium text-foreground">No releases yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  We found followed artists, but there are no matching seeded releases yet.
                </p>
              </div>
            ) : (
              <>
                {artistFallback && !USE_MOCK_ARTIST_TAB && (
                  <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                    showing fallback releases while real artist data finishes connecting
                  </div>
                )}
                {artistSections.map((section) => (
              <section key={section.key} className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-foreground">{section.title}</h3>
                    <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                  </div>
                  {section.key === "popular" && (
                    <span className="text-xs text-muted-foreground">WIP</span>
                  )}
                </div>
                <div className={section.compact ? "space-y-2" : "space-y-3"}>
                  {section.items.map((track) => (
                    <UnifiedTrackCard
                      key={track.id}
                      compact={section.compact}
                      hideReactions={section.compact}
                      track={{
                        id: track.trackDbId || track.id,
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        spotifyTrackId: track.spotifyTrackId,
                        albumArtUrl: track.albumArtUrl,
                        likeId: track.trackDbId || track.id,
                        trackDbId: track.trackDbId,
                        localOnly: !track.trackDbId,
                      }}
                      isSaved={track.trackDbId ? isSaved(track.trackDbId) : false}
                      onToggleSave={() => {
                        if (!track.trackDbId) {
                          toast("save will unlock once this release is synced");
                          return;
                        }
                        toggleSave(track.trackDbId, undefined, "artists");
                      }}
                      onShare={() => {
                        if (!track.trackDbId) {
                          toast("sharing will unlock once this release is synced");
                          return;
                        }
                        setRecommendTrack({ id: track.trackDbId, title: track.title });
                      }}
                      subtitle={
                        section.compact ? (
                          <div>
                            {renderArtistBadge(track.badge)}
                            {renderLikedBy(track.likedBy)}
                          </div>
                        ) : (
                          <div>
                            {renderArtistBadge(track.badge)}
                            {renderLikedBy(track.likedBy)}
                          </div>
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
              </>
            )}
          </div>
        ) : tab === "trending" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground">trending this week</p>
              <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                WIP — some links may be buggy
              </span>
            </div>
            {trendingTracks.map((track) => {
              const bgColor = track.position % 2 === 1 ? "#FF2D78" : "#1a2535";
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
                      navigator.share({
                        title: track.title,
                        url: `https://open.spotify.com/track/${track.spotifyTrackId}`,
                      });
                    } else {
                      navigator.clipboard.writeText(`https://open.spotify.com/track/${track.spotifyTrackId}`);
                      toast("link copied");
                    }
                  }}
                  subtitle={<span className="text-[10px] text-muted-foreground">#{track.position}</span>}
                />
              );
            })}
          </div>
        ) : tab === "people" ? (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={peopleQuery}
                onChange={(e) => handlePeopleSearch(e.target.value)}
                placeholder="search users..."
                className="bg-card border-border pl-10"
              />
            </div>
            {peopleLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-2">
                {people.map((u) => (
                  <UserCard key={u.id} profile={u} showFollow />
                ))}
                {people.length === 0 &&
                  !peopleQuery &&
                  demoUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 relative"
                    >
                      <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
                        example
                      </span>
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20">
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                          {u.display_name[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          @{u.username} · {u.genre}
                        </p>
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
                plaiPicks.map((pick: any) => (
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
                        else {
                          navigator.clipboard.writeText(url);
                          toast("link copied");
                        }
                      }
                    }}
                    subtitle={
                      <span className="text-[10px] text-muted-foreground">
                        #{pick.position}
                        {pick.note ? ` · ${pick.note}` : ""}
                      </span>
                    }
                  />
                ))
              ) : (
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
              <span className="inline-block rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground mb-2">
                coming soon
              </span>
              <p className="text-sm text-foreground">your plai·lists</p>
              <p className="text-xs text-muted-foreground mt-1">create and share your own · coming soon</p>
            </div>
          </div>
        )}
      </main>

      {recommendTrack && (
        <RecommendModal
          trackId={recommendTrack.id}
          trackTitle={recommendTrack.title}
          onClose={() => setRecommendTrack(null)}
        />
      )}
      <BottomNav />
    </div>
  );
};

export default Feed;
