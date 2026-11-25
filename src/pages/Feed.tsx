import PageTip from "@/components/PageTip";
import { FRIENDS_TIPS, DISCOVER_TIPS } from "@/lib/tips";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/contexts/SavedTracksContext";
import { supabase } from "@/integrations/supabase/client";
import { getTrackPlatform, PLATFORM_LABELS } from "@/lib/trackLinks";
import { toast } from "sonner";
import UnifiedTrackCard from "@/components/UnifiedTrackCard";
import BottomNav from "@/components/BottomNav";
import PlaiLogo from "@/components/PlaiLogo";
import NotificationBell from "@/components/NotificationBell";
import HomeTagline, { HomeTaglineRef } from "@/components/HomeTagline";
import RecommendModal from "@/components/RecommendModal";
import { trendingTracks } from "@/lib/trending";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { demoFeedItems, demoUsers } from "@/lib/demoData";
import DiscoverPostCard, { type DiscoverPost } from "@/components/DiscoverPostCard";
import DiscoverPostModal from "@/components/DiscoverPostModal";
import TrendingSection from "@/components/discover/TrendingSection";
import FriendAvatars from "@/components/discover/FriendAvatars";
import ReleaseProjectCard, { type ReleaseProject } from "@/components/discover/ReleaseProjectCard";
import PeopleSection from "@/components/discover/PeopleSection";
import { formatTimestamp } from "@/lib/formatTimestamp";

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
    apple_music_id?: string | null;
    spotify_link_id?: string | null;
    tidal_track_id?: string | null;
    amazon_music_id?: string | null;
    short_id?: string | null;
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
  shortId?: string | null;
  releaseDate?: string | null;
  spotifyAlbumId?: string | null;
  albumType?: string | null;
  totalTracks?: number | null;
  badge?: "today" | "new";
  activityScore?: number;
  likedBy?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }[];
}

type LiveState = "live" | "new" | "syncing";
type FeedTab = "following" | "discover";
type DiscoverTab = "trending" | "releases" | "people" | "journal";

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

const RELEASES_MOCK_KEY = "plai-releases-mock";

const normalizeArtistName = (value?: string | null) =>
  value?.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase() || "";

const getArtistBadge = (releaseDate?: string | null): ArtistReleaseItem["badge"] => {
  if (!releaseDate) return undefined;
  const today = new Date();
  const release = new Date(releaseDate);
  const diffDays = Math.floor((today.getTime() - release.getTime()) / 86400000);
  if (diffDays <= 1) return "today";
  if (diffDays <= 7) return "new";
  return undefined;
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
  // /feed = friends, /discover = discover (its own bottom-menu button); ?tab= picks a discover section
  const location = useLocation();
  const navigate = useNavigate();
  const tab: FeedTab = location.pathname.startsWith("/discover") ? "discover" : "following";
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return t === "releases" || t === "people" || t === "journal" ? t : "trending";
  });
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "releases" || t === "people" || t === "journal" || t === "trending") setDiscoverTab(t);
  }, [location.search]);
  const headerHidden = useHideOnScroll();
  const [showWelcome, setShowWelcome] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("live");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(cachedHiddenTrackIds || []));
  const [collectionExclusionIds, setCollectionExclusionIds] = useState<Set<string>>(
    () => new Set(cachedCollectionExclusionIds || []),
  );


  const taglineRef = useRef<HomeTaglineRef>(null);
  const [logoFlash, setLogoFlash] = useState(false);
  const [recommendTrack, setRecommendTrack] = useState<{ id: string; title: string; artist?: string; shortId?: string | null } | null>(null);

  // Admin → Releases → "Mock mode" shows demo releases (for demos)
  const [useMockReleases] = useState(() => localStorage.getItem(RELEASES_MOCK_KEY) === "1");
  const [artistItems, setArtistItems] = useState<ArtistReleaseItem[]>([]);
  const [artistLoading, setArtistLoading] = useState(true);
  const [artistError, setArtistError] = useState(false);
  const [artistEmptyState, setArtistEmptyState] = useState<"no-followed-artists" | "no-releases" | null>(null);
  const [journalPosts, setJournalPosts] = useState<DiscoverPost[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const [activePost, setActivePost] = useState<DiscoverPost | null>(null);

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
          `id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, apple_music_id, spotify_link_id, tidal_track_id, amazon_music_id, short_id, preview_url)`,
        )
        .in("user_id", userIds)
        .order("liked_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("Feed error:", error);
        toast.error("couldn't load feed — pull down to retry");
        setFeedLoading(false);
        return;
      }
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

        const hiddenLookup = new Set(((hiddenRows || []) as any[]).map((row: any) => `${row.user_id}:${row.track_id}`));
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
            supabase
              .from("collection_exclusions" as any)
              .select("track_id")
              .eq("user_id", user.id),
          ]).then(([hiddenRes, exclusionsRes]) => {
            const nextHiddenIds = ((hiddenRes.data || []) as any[]).map((r: any) => r.track_id);
            const nextExclusionIds = ((exclusionsRes.data || []) as any[]).map((r: any) => r.track_id);
            cachedHiddenTrackIds = nextHiddenIds;
            cachedCollectionExclusionIds = nextExclusionIds;
            setHiddenIds(new Set(nextHiddenIds));
            setCollectionExclusionIds(new Set(nextExclusionIds));
          });
          const usernamePromise = supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single()
            .then(({ data }) => setCurrentUsername((data as any)?.username || null));
          await Promise.all([feedPromise, filtersPromise, usernamePromise]);
        } else {
          await feedPromise;
        }
      } finally {
        setFiltersReady(true);
      }
    };
    init();
  }, [user]);

  useEffect(() => {
    const loadJournalPosts = async () => {
      setJournalLoading(true);
      try {
        const { data } = await (supabase
          .from("discover_posts" as any)
          .select("*")
          .eq("status", "published")
          .order("published_at", { ascending: false }) as any);

        setJournalPosts((data || []) as DiscoverPost[]);
      } catch {
        setJournalPosts([]);
      } finally {
        setJournalLoading(false);
        setJournalLoaded(true);
      }
    };

    if (tab === "discover" && discoverTab === "journal" && !journalLoaded && !journalLoading) {
      loadJournalPosts();
    }
  }, [tab, discoverTab, journalLoaded, journalLoading]);

  useEffect(() => {
    const loadArtistReleases = async () => {
      if (!user) return;

      if (useMockReleases) {
        setArtistItems(artistReleaseFallbackItems);
        setArtistLoading(false);
        setArtistError(false);
        setArtistEmptyState(null);
        return;
      }

      setArtistLoading(true);
      setArtistEmptyState(null);
      setArtistError(false);

      try {
        const { data: followedRows, error: followedError } = await (supabase
          .from("user_followed_artists" as any)
          .select("artist_name")
          .eq("user_id", user.id) as any);

        if (followedError) throw followedError;

        // Split comma-separated entries (handles legacy multi-artist rows pre-fix)
        const followedRawNames = ((followedRows || []) as any[])
          .flatMap((row: any) =>
            typeof row.artist_name === "string"
              ? row.artist_name.split(/\s*,\s*/).map((n: string) => n.trim()).filter(Boolean)
              : [],
          );
        const followedNames = [
          ...new Set(followedRawNames.map((name: string) => normalizeArtistName(name)).filter(Boolean)),
        ];

        if (followedNames.length === 0) {
          setArtistItems([]);
          setArtistEmptyState("no-followed-artists");
          setArtistLoading(false);
          return;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 60);
        const cutoffIso = cutoffDate.toISOString().slice(0, 10);

        const { data: releaseRows, error: releaseError } = await (supabase
          .from("artist_releases" as any)
          .select("*")
          .gte("release_date", cutoffIso)
          .order("release_date", { ascending: false }) as any);

        if (releaseError) throw releaseError;

        // Only releases by artists this person follows
        const followedSet = new Set(followedNames);
        const myReleases = ((releaseRows || []) as any[]).filter((row: any) =>
          followedSet.has(normalizeArtistName(row.artist_name)),
        );
        const releaseSpotifyIds: string[] = [
          ...new Set(myReleases.map((row: any) => row.spotify_track_id).filter(Boolean)),
        ];

        const trackIdBySpotifyId = new Map<string, string>();
        const shortIdByTrackId = new Map<string, string>();
        if (releaseSpotifyIds.length > 0) {
          // A release's song is in PLAI either under its own Spotify ID, or (for songs first added
          // from Apple Music / Tidal) with that ID matched in spotify_link_id
          const idList = releaseSpotifyIds.join(",");
          const { data: trackRows } = await (supabase
            .from("tracks")
            .select("id, spotify_track_id, spotify_link_id, short_id")
            .or(`spotify_track_id.in.(${idList}),spotify_link_id.in.(${idList})`) as any);

          ((trackRows || []) as any[]).forEach((trackRow) => {
            if (!trackRow.id) return;
            for (const sid of [trackRow.spotify_track_id, trackRow.spotify_link_id]) {
              if (sid && releaseSpotifyIds.includes(sid) && !trackIdBySpotifyId.has(sid)) {
                trackIdBySpotifyId.set(sid, trackRow.id);
                if (trackRow.short_id) shortIdByTrackId.set(trackRow.id, trackRow.short_id);
              }
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
        // save count per trackId (from following users)
        const saveCountByTrackId = new Map<string, number>();
        // reaction count per trackId (from following users), weighted 1/3
        const reactionCountByTrackId = new Map<string, number>();

        if (followingIds.length > 0) {
          const matchedTrackIds = [...new Set(Array.from(trackIdBySpotifyId.values()).filter(Boolean))];
          if (matchedTrackIds.length > 0) {
            const { data: likeRows } = await (supabase
              .from("likes" as any)
              .select("id, track_id, user_id, profiles!likes_user_id_fkey(id, username, display_name, avatar_url)")
              .in("user_id", followingIds)
              .in("track_id", matchedTrackIds) as any);

            // Build a profile lookup from savers for use when merging reactors below
            const profileById = new Map<string, { id: string; username: string; displayName: string; avatarUrl: string | null }>();
            const likeIdsByTrackId = new Map<string, string[]>();
            ((likeRows || []) as any[]).forEach((row) => {
              const profile = row.profiles;
              if (!row.track_id || !profile?.id) return;
              const entry = {
                id: profile.id,
                username: profile.username || "user",
                displayName: profile.display_name || profile.username || "User",
                avatarUrl: profile.avatar_url || null,
              };
              profileById.set(profile.id, entry);
              const existing = likedByTrackId.get(row.track_id) || [];
              if (!existing.some((friend) => friend.id === profile.id)) {
                likedByTrackId.set(row.track_id, [...existing, entry]);
              }
              saveCountByTrackId.set(row.track_id, (saveCountByTrackId.get(row.track_id) || 0) + 1);
              if (row.id) {
                likeIdsByTrackId.set(row.track_id, [...(likeIdsByTrackId.get(row.track_id) || []), row.id]);
              }
            });

            // Fetch reactions from following users, tally weighted scores + merge reactors into likedBy
            const allLikeIds = Array.from(likeIdsByTrackId.values()).flat();
            if (allLikeIds.length > 0) {
              const { data: reactionRows } = await (supabase
                .from("reactions" as any)
                .select("like_id, user_id")
                .in("like_id", allLikeIds)
                .in("user_id", followingIds) as any);

              const likeIdToTrackId = new Map<string, string>();
              likeIdsByTrackId.forEach((likeIds, trackId) => {
                likeIds.forEach((lid) => likeIdToTrackId.set(lid, trackId));
              });

              // Fetch profiles for reactors not already in profileById
              const newReactorIds = [
                ...new Set(
                  ((reactionRows || []) as any[])
                    .map((r: any) => r.user_id)
                    .filter((id: string) => id && !profileById.has(id)),
                ),
              ];
              if (newReactorIds.length > 0) {
                const { data: reactorProfiles } = await (supabase
                  .from("profiles")
                  .select("id, username, display_name, avatar_url")
                  .in("id", newReactorIds) as any);
                ((reactorProfiles || []) as any[]).forEach((p: any) => {
                  if (p?.id) {
                    profileById.set(p.id, {
                      id: p.id,
                      username: p.username || "user",
                      displayName: p.display_name || p.username || "User",
                      avatarUrl: p.avatar_url || null,
                    });
                  }
                });
              }

              ((reactionRows || []) as any[]).forEach((row) => {
                const trackId = likeIdToTrackId.get(row.like_id);
                if (!trackId) return;
                reactionCountByTrackId.set(trackId, (reactionCountByTrackId.get(trackId) || 0) + 1);
                // Merge reactor into likedBy (deduplicated)
                if (row.user_id && profileById.has(row.user_id)) {
                  const existing = likedByTrackId.get(trackId) || [];
                  if (!existing.some((f) => f.id === row.user_id)) {
                    likedByTrackId.set(trackId, [...existing, profileById.get(row.user_id)!]);
                  }
                }
              });
            }
          }
        }

        const matched = myReleases
          .map((row) => {
            const trackDbId = trackIdBySpotifyId.get(row.spotify_track_id);
            const saves = trackDbId ? (saveCountByTrackId.get(trackDbId) || 0) : 0;
            const reactions = trackDbId ? (reactionCountByTrackId.get(trackDbId) || 0) : 0;
            return {
              id: row.id,
              title: row.title,
              artist: row.artist_name,
              album: row.album,
              spotifyTrackId: row.spotify_track_id,
              albumArtUrl: row.album_art_url,
              trackDbId,
              shortId: trackDbId ? shortIdByTrackId.get(trackDbId) || null : null,
              releaseDate: row.release_date || null,
              spotifyAlbumId: row.spotify_album_id || null,
              albumType: row.album_type || null,
              totalTracks: row.total_tracks ?? null,
              badge: getArtistBadge(row.release_date),
              activityScore: saves + reactions / 3,
              likedBy: likedByTrackId.get(trackDbId || "") || undefined,
            };
          }) as ArtistReleaseItem[];

        if (matched.length === 0) {
          setArtistItems([]);
          setArtistEmptyState("no-releases");
          setArtistLoading(false);
          return;
        }

        setArtistItems(matched);
        setArtistLoading(false);
      } catch {
        setArtistItems([]);
        setArtistError(true);
        setArtistLoading(false);
      }
    };

    loadArtistReleases();
    // Re-run once the friends list arrives, so "popular releases" can show friends' likes
  }, [user, followingIds]);

  useEffect(() => {
    if (!user || useMockReleases) return;
    // Check for new releases in the background (the server does this at most twice a day,
    // using PLAI's own Spotify access when this person hasn't connected Spotify)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.functions.invoke("sync-artist-releases", { body: { user_id: user.id } }).catch(() => {});
      }
    });
  }, [user, useMockReleases]);

  const openDiscoverPost = (post: DiscoverPost) => {
    if (post.post_type === "external" && post.external_url) {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (isStandalone) {
        window.location.href = post.external_url;
      } else {
        window.open(post.external_url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setActivePost(post);
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
              "id, liked_at, user_id, track_id, profiles!likes_user_id_fkey(id, display_name, avatar_url, username), tracks(id, title, artist, album, album_art_url, spotify_track_id, apple_music_id, spotify_link_id, tidal_track_id, amazon_music_id, short_id, preview_url)",
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

  const handlePullRefresh = useCallback(async () => {
    const ids = await loadFollowing();
    await loadFeed(ids);
    cachedHiddenTrackIds = null;
    cachedCollectionExclusionIds = null;
    if (user) {
      const [hiddenRes, exclusionsRes] = await Promise.all([
        supabase
          .from("hidden_tracks" as any)
          .select("track_id")
          .eq("user_id", user.id),
        supabase
          .from("collection_exclusions" as any)
          .select("track_id")
          .eq("user_id", user.id),
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
  const visibleFeedItems = items.filter(
    (item) => !hiddenIds.has(item.track_id) && !collectionExclusionIds.has(item.track_id),
  );
  const hasContent = visibleFeedItems.length > 0;
  const showFeedLoading = feedLoading || !filtersReady;
  const showInitialFeedLoading = showFeedLoading && !(items.length > 0 && filtersReady);

  const discoverTabs = [
    { key: "trending", label: "trending" },
    { key: "releases", label: "releases" },
    { key: "people", label: "people" },
    { key: "journal", label: "journal" },
  ] as const;

  const renderArtistBadge = (badge?: ArtistReleaseItem["badge"]) => {
    if (!badge) return null;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
          badge === "today" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
        }`}
      >
        {badge}
      </span>
    );
  };

  // Popular: only releases the people you follow have actually liked or reacted to
  const popularReleases = artistItems
    .filter((t) => (t.likedBy?.length ?? 0) > 0)
    .sort((a, b) => (b.activityScore ?? 0) - (a.activityScore ?? 0))
    .slice(0, 3);

  // All releases, one entry per project (album / EP / single)
  const projectTypeLabel = (type?: string | null, total?: number | null, songs = 1) => {
    if (type === "album") return "Album";
    if (type === "compilation") return "Compilation";
    if (type === "single") return (total ?? songs) >= 4 ? "EP" : "Single";
    return songs > 1 ? "Project" : "Single";
  };
  const releaseProjects = (() => {
    const groups = new Map<string, ArtistReleaseItem[]>();
    for (const t of artistItems) {
      const key = t.spotifyAlbumId || `${(t.album || t.title).toLowerCase()}|${t.artist.toLowerCase()}`;
      groups.set(key, [...(groups.get(key) || []), t]);
    }
    return [...groups.entries()]
      .map(([key, tracks]) => {
        const first = tracks[0];
        const friends = new Map<string, NonNullable<ArtistReleaseItem["likedBy"]>[number]>();
        tracks.forEach((t) => t.likedBy?.forEach((f) => friends.set(f.id, f)));
        const project: ReleaseProject = {
          key,
          album: first.album || first.title,
          artist: first.artist,
          albumArtUrl: first.albumArtUrl,
          spotifyAlbumId: first.spotifyAlbumId || null,
          typeLabel: projectTypeLabel(first.albumType, first.totalTracks, tracks.length),
          totalTracks: first.totalTracks ?? null,
          badge: first.badge,
          releaseDate: first.releaseDate || null,
          friends: [...friends.values()],
        };
        return { project, tracks };
      })
      .sort((a, b) => (b.project.releaseDate || "").localeCompare(a.project.releaseDate || ""));
  })();

  const renderReleaseTrack = (track: ArtistReleaseItem, compact: boolean, insideProject = false) => (
    <UnifiedTrackCard
      key={track.id}
      compact={compact}
      hideReactions={compact}
      track={{
        id: track.trackDbId || track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        spotifyTrackId: track.spotifyTrackId,
        albumArtUrl: track.albumArtUrl,
        likeId: track.trackDbId || track.id,
        trackDbId: track.trackDbId,
        shortId: track.shortId,
        localOnly: !track.trackDbId,
      }}
      isSaved={track.trackDbId ? isSaved(track.trackDbId) : false}
      onToggleSave={() => {
        if (!track.trackDbId) {
          toast("this song is still being added to PLAI — try again in a minute");
          return;
        }
        toggleSave(track.trackDbId, undefined, "discover_releases");
      }}
      onShare={() => {
        if (!track.trackDbId) {
          toast("this song is still being added to PLAI — try again in a minute");
          return;
        }
        setRecommendTrack({ id: track.trackDbId, title: track.title, artist: track.artist, shortId: track.shortId });
      }}
      subtitle={
        <div>
          {!insideProject && renderArtistBadge(track.badge)}
          <FriendAvatars friends={track.likedBy} />
        </div>
      }
    />
  );

  const LiveIndicator = () => {
    if (liveState === "syncing") {
      return (
        <button
          onClick={handleLiveTap}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse-live opacity-50" />
          <span style={{ color: "hsl(var(--muted-foreground))" }}>syncing...</span>
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
          <span className="h-2 w-2 rounded-full animate-pulse-live" style={{ backgroundColor: "hsl(var(--foreground))" }} />
          <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{pendingItems.length} new</span>
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
      <PullToRefreshIndicator {...pullToRefresh} />
      <header
        className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md transition-transform duration-300 ease-out"
        style={{ paddingTop: "env(safe-area-inset-top)", transform: headerHidden ? "translateY(-100%)" : "translateY(0)" }}
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
                background: logoFlash ? "hsl(var(--primary) / 0.15)" : "transparent",
                transition: "background 0.15s ease",
                padding: "1px 2px",
              }}
            >
              <PlaiLogo className="text-xl" />
            </div>
            <HomeTagline ref={taglineRef} />
          </div>
          <div className="flex items-center gap-2">
            {tab === "following" && <LiveIndicator />}
            <NotificationBell />
          </div>
        </div>
        {tab === "discover" && (
          <div className="mx-auto flex max-w-feed gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
            {discoverTabs.map((subtab) => (
              <button
                key={subtab.key}
                onClick={() => {
                  setDiscoverTab(subtab.key);
                  window.scrollTo({ top: 0 });
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                  discoverTab === subtab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground"
                }`}
              >
                {subtab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-feed px-4 py-4">
        {tab === "following" ? (
          <PageTip id="friends" steps={FRIENDS_TIPS} className="mb-4" />
        ) : (
          <PageTip id="discover" steps={DISCOVER_TIPS} className="mb-4" />
        )}
        {tab === "following" ? (
          <>
            {!hasFollowing && !hasContent && !showInitialFeedLoading ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/30 bg-card p-4 text-center">
                  <p className="text-sm text-foreground mb-1">this is what your feed looks like</p>
                  <p className="text-xs text-muted-foreground mb-3">follow friends to see the real thing</p>
                  <button
                    onClick={() => navigate("/discover?tab=people")}
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
                        appleMusicId: track?.apple_music_id,
                        spotifyLinkId: track?.spotify_link_id,
                        tidalTrackId: track?.tidal_track_id,
                        amazonMusicId: track?.amazon_music_id,
                        shortId: track?.short_id,
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
                      onShare={() => setRecommendTrack({ id: item.track_id, title: track?.title, artist: track?.artist, shortId: track?.short_id })}
                      sharerUsername={currentUsername ?? undefined}
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
                          </div>
                        </div>
                      }
                      subtitle={
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center rounded-full bg-card border px-2 py-0.5 text-[10px] font-medium flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--muted-foreground))" }}>
                            {PLATFORM_LABELS[getTrackPlatform(track?.spotify_track_id)]}
                          </span>
                          <span className="truncate text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {formatTimestamp(item.liked_at)}
                          </span>
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
                  onClick={() => navigate("/discover?tab=people")}
                  className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
                >
                  find friends
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">

            {discoverTab === "trending" ? (
              <TrendingSection onShare={setRecommendTrack} sharerUsername={currentUsername ?? undefined} followingIds={followingIds} />
            ) : discoverTab === "releases" ? (
              <div className="space-y-6">
                {artistLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : artistEmptyState === "no-followed-artists" ? (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <h3 className="text-sm font-medium text-foreground">No artists followed yet</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      When you save or share a song, PLAI follows that artist for you, and their new music shows up here.
                    </p>
                  </div>
                ) : artistEmptyState === "no-releases" ? (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <h3 className="text-sm font-medium text-foreground">No new releases right now</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      None of the artists you follow have put out music in the last 60 days. We check again twice a day.
                    </p>
                  </div>
                ) : artistError ? (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <h3 className="text-sm font-medium text-foreground">Couldn't load releases</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Check your connection and pull down to try again.</p>
                  </div>
                ) : (
                  <>
                    {popularReleases.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="font-display text-lg text-foreground">popular with your friends</h3>
                          <p className="text-xs text-muted-foreground">new songs the people you follow are loving</p>
                        </div>
                        <div className="space-y-2">{popularReleases.map((track) => renderReleaseTrack(track, true))}</div>
                      </section>
                    )}
                    <section className="space-y-3">
                      <div>
                        <h3 className="font-display text-lg text-foreground">new from artists you follow</h3>
                        <p className="text-xs text-muted-foreground">albums, EPs and singles from the last 60 days</p>
                      </div>
                      <div className="space-y-2">
                        {releaseProjects.map(({ project, tracks }) =>
                          tracks.length === 1 && project.typeLabel === "Single" ? (
                            renderReleaseTrack(tracks[0], true)
                          ) : (
                            <ReleaseProjectCard key={project.key} project={project} badge={renderArtistBadge(project.badge)}>
                              {tracks.map((track) => renderReleaseTrack(track, true, true))}
                            </ReleaseProjectCard>
                          ),
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            ) : discoverTab === "people" ? (
              <PeopleSection userId={user.id} />
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg text-foreground">journal</h3>
                  <p className="text-xs text-muted-foreground">picks, playlists and stories from PLAI</p>
                </div>
                {journalLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : journalPosts.length > 0 ? (
                  <div className="space-y-2">
                    {journalPosts.map((post) => (
                      <DiscoverPostCard key={post.id} post={post} onOpen={openDiscoverPost} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <h3 className="text-sm font-medium text-foreground">Nothing in the journal yet</h3>
                    <p className="mt-1 text-xs text-muted-foreground">New stories and picks from PLAI will appear here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {recommendTrack && (
        <RecommendModal
          trackId={recommendTrack.id}
          trackTitle={recommendTrack.title}
          trackArtist={recommendTrack.artist}
          shortId={recommendTrack.shortId}
          sharerUsername={currentUsername ?? undefined}
          onClose={() => setRecommendTrack(null)}
        />
      )}
      {activePost && activePost.post_type === "internal" && (
        <DiscoverPostModal post={activePost} onClose={() => setActivePost(null)} />
      )}
      <BottomNav />
    </div>
  );
};

export default Feed;
