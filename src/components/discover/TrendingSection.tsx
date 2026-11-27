import { useEffect, useState } from "react";
import { Heart, Smile, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UnifiedTrackCard, {
  type UnifiedTrackData,
} from "@/components/UnifiedTrackCard";
import FriendAvatars, {
  loadFriendLikes,
  type FriendLike,
} from "@/components/discover/FriendAvatars";
import { CHART_COUNTRIES, chartKey, countryName, flag, getChartCountry, setChartCountry } from "@/lib/chartCountry";

/**
 * Discover → trending.
 *  1. "this week on PLAI": songs with the most likes, saves, reactions and share-link opens on PLAI
 *     (database function trending_tracks). Widens to 30 days while PLAI is small.
 *  2. "top songs in <country>": that country's Apple Music chart (your country by default, switchable),
 *     cached by the refresh-charts function.
 */

export interface ShareableTrack {
  id: string;
  title: string;
  artist?: string;
  shortId?: string | null;
}

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  spotify_track_id: string;
  spotify_link_id: string | null;
  apple_music_id: string | null;
  tidal_track_id: string | null;
  amazon_music_id: string | null;
  short_id: string | null;
}

interface TrendingRow extends Omit<TrackRow, "id"> {
  track_id: string;
  likers: number;
  saves: number;
  reactions: number;
  opens: number;
  score: number;
}

const TRACK_COLUMNS =
  "id, title, artist, album, album_art_url, spotify_track_id, spotify_link_id, apple_music_id, tidal_track_id, amazon_music_id, short_id";
const CHART_MAX_AGE_MS = 12 * 3_600_000;
const MIN_TRENDING = 5;

let cache: {
  trending: TrendingRow[];
  days: number;
  chart: TrackRow[];
  country: string;
  friends: Map<string, FriendLike[]>;
  at: number;
} | null = null;

async function loadChart(cc: string) {
  const { data } = await (supabase
    .from("chart_tracks" as any)
    .select(`position, fetched_at, tracks(${TRACK_COLUMNS})`)
    .eq("chart", chartKey(cc))
    .order("position") as any);
  const rows = (data || []) as { position: number; fetched_at: string; tracks: TrackRow | null }[];
  return {
    tracks: rows.map((r) => r.tracks).filter((t): t is TrackRow => !!t),
    fetchedAt: rows[0]?.fetched_at ? new Date(rows[0].fetched_at).getTime() : 0,
  };
}

/** A country's chart, asking the server to refresh it first if the stored copy is missing or old */
async function loadChartFresh(cc: string): Promise<TrackRow[]> {
  try {
    let result = await loadChart(cc);
    if (result.tracks.length === 0 || Date.now() - result.fetchedAt > CHART_MAX_AGE_MS) {
      // (the server only calls Apple if its copy is stale)
      await supabase.functions.invoke("refresh-charts", { body: { storefront: cc } }).catch(() => {});
      result = await loadChart(cc);
    }
    return result.tracks;
  } catch {
    return [];
  }
}

const toCard = (t: TrackRow): UnifiedTrackData => ({
  id: t.id,
  trackDbId: t.id,
  title: t.title,
  artist: t.artist,
  album: t.album,
  albumArtUrl: t.album_art_url,
  spotifyTrackId: t.spotify_track_id,
  spotifyLinkId: t.spotify_link_id,
  appleMusicId: t.apple_music_id,
  tidalTrackId: t.tidal_track_id,
  amazonMusicId: t.amazon_music_id,
  shortId: t.short_id,
});

/** Activity as small icon + number pairs; the full wording is kept for screen readers. */
const Activity = ({ r }: { r: TrendingRow }) => {
  const loved = r.likers + r.saves;
  const items = [
    {
      n: loved,
      Icon: Heart,
      label: `${loved} ${loved === 1 ? "person loved" : "people loved"} this`,
    },
    {
      n: r.reactions,
      Icon: Smile,
      label: `${r.reactions} ${r.reactions === 1 ? "reaction" : "reactions"}`,
    },
    {
      n: r.opens,
      Icon: Play,
      label: `${r.opens} ${r.opens === 1 ? "play" : "plays"} from PLAI links`,
    },
  ].filter((i) => i.n > 0);
  if (items.length === 0) return null;
  return (
    <div
      className="flex items-center gap-3 pt-1 text-[11px] tabular-nums text-muted-foreground"
      aria-label={items.map((i) => i.label).join(", ")}
    >
      {items.map(({ n, Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1"
          title={label}
          aria-hidden="true"
        >
          <Icon className="h-3 w-3" strokeWidth={2.25} />
          {n}
        </span>
      ))}
    </div>
  );
};

interface TrendingSectionProps {
  onShare: (track: ShareableTrack) => void;
  sharerUsername?: string;
  /** People the viewer follows — their avatars show on songs they've liked */
  followingIds: string[];
}

const TrendingSection = ({
  onShare,
  sharerUsername,
  followingIds,
}: TrendingSectionProps) => {
  const [trending, setTrending] = useState<TrendingRow[]>(
    cache?.trending || [],
  );
  const [days, setDays] = useState(cache?.days || 7);
  const [chart, setChart] = useState<TrackRow[]>(cache?.chart || []);
  const [friends, setFriends] = useState<Map<string, FriendLike[]>>(
    cache?.friends || new Map(),
  );
  const [loading, setLoading] = useState(!cache);
  const [country, setCountry] = useState(() => cache?.country || getChartCountry());
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (cache && Date.now() - cache.at < 5 * 60_000) return;
    let cancelled = false;

    // Each part loads on its own, so one failing never blanks the other
    const loadTrending = async (): Promise<{
      rows: TrendingRow[];
      days: number;
    }> => {
      try {
        // (call through the client object — a detached supabase.rpc loses its connection)
        const rpc = (fn: string, args: Record<string, unknown>) =>
          (supabase as any).rpc(fn, args);
        const { data: week } = await rpc("trending_tracks", {
          p_days: 7,
          p_limit: 10,
        });
        if (week && week.length >= MIN_TRENDING) return { rows: week, days: 7 };
        const { data: month } = await rpc("trending_tracks", {
          p_days: 30,
          p_limit: 10,
        });
        if (month && month.length > (week?.length || 0))
          return { rows: month, days: 30 };
        return { rows: week || [], days: 7 };
      } catch {
        return { rows: [], days: 7 };
      }
    };

    const load = async () => {
      const cc = country;
      const [t, chartTracks] = await Promise.all([
        loadTrending(),
        loadChartFresh(cc),
      ]);
      const ids = [
        ...new Set([
          ...t.rows.map((r) => r.track_id),
          ...chartTracks.map((c) => c.id),
        ]),
      ];
      const friendMap = await loadFriendLikes(ids, followingIds).catch(
        () => new Map<string, FriendLike[]>(),
      );
      if (cancelled) return;
      cache = {
        trending: t.rows,
        days: t.days,
        chart: chartTracks,
        country: cc,
        friends: friendMap,
        at: Date.now(),
      };
      setTrending(t.rows);
      setDays(t.days);
      setChart(chartTracks);
      setFriends(friendMap);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingIds]);

  // Switching country: reload just the chart
  const changeCountry = async (cc: string) => {
    setCountry(cc);
    setChartCountry(cc);
    setChartLoading(true);
    const tracks = await loadChartFresh(cc);
    const friendMap = await loadFriendLikes(tracks.map((t) => t.id), followingIds).catch(
      () => new Map<string, FriendLike[]>(),
    );
    setChart(tracks);
    setFriends((prev) => new Map([...prev, ...friendMap]));
    if (cache) cache = { ...cache, chart: tracks, country: cc };
    setChartLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const trendingIds = new Set(trending.map((t) => t.track_id));
  const chartRows = chart.filter((t) => !trendingIds.has(t.id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-lg text-foreground">
            {days === 7 ? "this week on PLAI" : "this month on PLAI"}
          </h3>
          <p className="text-xs text-muted-foreground">
            the songs people on PLAI are liking, saving and sharing most
          </p>
        </div>
        {trending.length > 0 ? (
          <div className="space-y-2">
            {trending.map((r, i) => {
              const row: TrackRow = { ...r, id: r.track_id };
              return (
                <UnifiedTrackCard
                  key={r.track_id}
                  rank={i + 1}
                  compact
                  track={toCard(row)}
                  hideReactions
                  sourceContext="discover_trending"
                  sharerUsername={sharerUsername}
                  onShare={() =>
                    onShare({
                      id: r.track_id,
                      title: r.title,
                      artist: r.artist,
                      shortId: r.short_id,
                    })
                  }
                  subtitle={
                    <div>
                      <Activity r={r} />
                      <FriendAvatars friends={friends.get(r.track_id)} />
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <h4 className="text-sm font-medium text-foreground">
              Nothing trending yet
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Songs show up here as people like, save and share them on PLAI.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
            <div>
              <h3 className="font-display text-lg text-foreground">top songs right now</h3>
              <p className="text-xs text-muted-foreground">the Apple Music chart, updated twice a day</p>
            </div>
            {/* country picker: a chip with the phone's own list picker underneath */}
            <label className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-primary/50">
              <span aria-hidden="true">{flag(country)}</span>
              <span>{countryName(country)}</span>
              <span aria-hidden="true" className="text-muted-foreground">▾</span>
              <select
                id="chart-country"
                aria-label="chart country"
                value={country}
                onChange={(e) => changeCountry(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {[...CHART_COUNTRIES]
                  .sort((a, b) => countryName(a).localeCompare(countryName(b)))
                  .map((cc) => (
                    <option key={cc} value={cc}>
                      {flag(cc)} {countryName(cc)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {chartLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : chartRows.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-5 text-center text-xs text-muted-foreground">
              The {countryName(country)} chart isn't available right now. Try again in a bit, or pick another country.
            </p>
          ) : (
          <div className="space-y-2">
            {chartRows.map((t) => (
              <UnifiedTrackCard
                key={t.id}
                rank={chart.indexOf(t) + 1}
                compact
                hideReactions
                track={toCard(t)}
                sourceContext="discover_chart"
                sharerUsername={sharerUsername}
                onShare={() =>
                  onShare({
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    shortId: t.short_id,
                  })
                }
                subtitle={<FriendAvatars friends={friends.get(t.id)} />}
              />
            ))}
          </div>
          )}
        </section>
    </div>
  );
};

export default TrendingSection;
