import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import UnifiedTrackCard, { type UnifiedTrackData } from "@/components/UnifiedTrackCard";
import FriendAvatars, { loadFriendLikes, type FriendLike } from "@/components/discover/FriendAvatars";

/**
 * Discover → trending.
 *  1. "this week on PLAI": songs with the most likes, saves, reactions and share-link opens on PLAI
 *     (database function trending_tracks). Widens to 30 days while PLAI is small.
 *  2. "top songs right now": the Apple Music US chart, cached by the refresh-charts function.
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

let cache: { trending: TrendingRow[]; days: number; chart: TrackRow[]; friends: Map<string, FriendLike[]>; at: number } | null = null;

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

const activityLine = (r: TrendingRow) => {
  const parts: string[] = [];
  if (r.likers) parts.push(`${r.likers} ${r.likers === 1 ? "person" : "people"} liked`);
  if (r.saves) parts.push(`${r.saves} ${r.saves === 1 ? "save" : "saves"}`);
  if (r.reactions) parts.push(`${r.reactions} ${r.reactions === 1 ? "reaction" : "reactions"}`);
  if (r.opens) parts.push(`${r.opens} link ${r.opens === 1 ? "open" : "opens"}`);
  return parts.join(" · ");
};

const RankBadge = ({ rank }: { rank: number }) => (
  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
    {rank}
  </span>
);

interface TrendingSectionProps {
  onShare: (track: ShareableTrack) => void;
  sharerUsername?: string;
  /** People the viewer follows — their avatars show on songs they've liked */
  followingIds: string[];
}

const TrendingSection = ({ onShare, sharerUsername, followingIds }: TrendingSectionProps) => {
  const [trending, setTrending] = useState<TrendingRow[]>(cache?.trending || []);
  const [days, setDays] = useState(cache?.days || 7);
  const [chart, setChart] = useState<TrackRow[]>(cache?.chart || []);
  const [friends, setFriends] = useState<Map<string, FriendLike[]>>(cache?.friends || new Map());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache && Date.now() - cache.at < 5 * 60_000) return;
    let cancelled = false;

    const loadChart = async () => {
      const { data } = await (supabase
        .from("chart_tracks" as any)
        .select(`position, fetched_at, tracks(${TRACK_COLUMNS})`)
        .eq("chart", "apple-us-top-songs")
        .order("position") as any);
      const rows = (data || []) as { position: number; fetched_at: string; tracks: TrackRow | null }[];
      return {
        tracks: rows.map((r) => r.tracks).filter((t): t is TrackRow => !!t),
        fetchedAt: rows[0]?.fetched_at ? new Date(rows[0].fetched_at).getTime() : 0,
      };
    };

    // Each part loads on its own, so one failing never blanks the other
    const loadTrending = async (): Promise<{ rows: TrendingRow[]; days: number }> => {
      try {
        // (call through the client object — a detached supabase.rpc loses its connection)
        const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);
        const { data: week } = await rpc("trending_tracks", { p_days: 7, p_limit: 10 });
        if (week && week.length >= MIN_TRENDING) return { rows: week, days: 7 };
        const { data: month } = await rpc("trending_tracks", { p_days: 30, p_limit: 10 });
        if (month && month.length > (week?.length || 0)) return { rows: month, days: 30 };
        return { rows: week || [], days: 7 };
      } catch {
        return { rows: [], days: 7 };
      }
    };

    const loadChartFresh = async (): Promise<TrackRow[]> => {
      try {
        let result = await loadChart();
        if (result.tracks.length === 0 || Date.now() - result.fetchedAt > CHART_MAX_AGE_MS) {
          // Ask the server to refresh the chart (it only calls Apple if the copy is stale)
          await supabase.functions.invoke("refresh-charts", { body: {} }).catch(() => {});
          result = await loadChart();
        }
        return result.tracks;
      } catch {
        return [];
      }
    };

    const load = async () => {
      const [t, chartTracks] = await Promise.all([loadTrending(), loadChartFresh()]);
      const ids = [...new Set([...t.rows.map((r) => r.track_id), ...chartTracks.map((c) => c.id)])];
      const friendMap = await loadFriendLikes(ids, followingIds).catch(() => new Map<string, FriendLike[]>());
      if (cancelled) return;
      cache = { trending: t.rows, days: t.days, chart: chartTracks, friends: friendMap, at: Date.now() };
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
  }, [followingIds]);

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
          <h3 className="font-display text-lg text-foreground">{days === 7 ? "this week on PLAI" : "this month on PLAI"}</h3>
          <p className="text-xs text-muted-foreground">the songs people on PLAI are liking, saving and sharing most</p>
        </div>
        {trending.length > 0 ? (
          <div className="space-y-3">
            {trending.map((r, i) => {
              const row: TrackRow = { ...r, id: r.track_id };
              return (
                <UnifiedTrackCard
                  key={r.track_id}
                  track={toCard(row)}
                  hideReactions
                  sourceContext="discover_trending"
                  sharerUsername={sharerUsername}
                  onShare={() => onShare({ id: r.track_id, title: r.title, artist: r.artist, shortId: r.short_id })}
                  subtitle={
                    <div>
                      <div className="flex items-center gap-2 pt-1">
                        <RankBadge rank={i + 1} />
                        <span className="text-[10px] text-muted-foreground">{activityLine(r)}</span>
                      </div>
                      <FriendAvatars friends={friends.get(r.track_id)} />
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <h4 className="text-sm font-medium text-foreground">Nothing trending yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Songs show up here as people like, save and share them on PLAI.
            </p>
          </div>
        )}
      </section>

      {chartRows.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="font-display text-lg text-foreground">top songs right now</h3>
            <p className="text-xs text-muted-foreground">the Apple Music US chart, updated twice a day</p>
          </div>
          <div className="space-y-2">
            {chartRows.map((t) => (
              <UnifiedTrackCard
                key={t.id}
                compact
                hideReactions
                track={toCard(t)}
                sourceContext="discover_chart"
                sharerUsername={sharerUsername}
                onShare={() => onShare({ id: t.id, title: t.title, artist: t.artist, shortId: t.short_id })}
                subtitle={
                  <div>
                    <RankBadge rank={chart.indexOf(t) + 1} />
                    <FriendAvatars friends={friends.get(t.id)} />
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TrendingSection;
