-- Discover: live trending, people suggestions, a cached music chart, journal publishing rules,
-- and release-sync throttling.

-- ── 1. Trending on PLAI ──────────────────────────────────────────────────────
-- Songs with the most activity in the last p_days: distinct people liking (×3), saves (×4),
-- reactions (×2) and share-page opens (×1, capped at 5 so one busy link can't dominate). Only aggregate counts are returned.
CREATE OR REPLACE FUNCTION public.trending_tracks(p_days int DEFAULT 7, p_limit int DEFAULT 20)
RETURNS TABLE (
  track_id uuid, title text, artist text, album text, album_art_url text,
  spotify_track_id text, spotify_link_id text, apple_music_id text, tidal_track_id text,
  amazon_music_id text, short_id text,
  likers int, saves int, reactions int, opens int, score int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH since AS (SELECT now() - make_interval(days => greatest(1, least(p_days, 90))) AS t),
  l AS (SELECT lk.track_id, count(DISTINCT lk.user_id)::int AS n
          FROM likes lk, since WHERE coalesce(lk.liked_at, lk.created_at) >= since.t GROUP BY lk.track_id),
  s AS (SELECT st.track_id, count(*)::int AS n FROM saved_tracks st, since WHERE st.saved_at >= since.t GROUP BY st.track_id),
  r AS (SELECT lk.track_id, count(*)::int AS n
          FROM reactions rx JOIN likes lk ON lk.id = rx.like_id, since WHERE rx.created_at >= since.t GROUP BY lk.track_id),
  o AS (SELECT so.track_id, count(*)::int AS n FROM share_opens so, since WHERE so.opened_at >= since.t GROUP BY so.track_id),
  scored AS (
    SELECT t.id, t.title, t.artist, t.album, t.album_art_url, t.spotify_track_id, t.spotify_link_id,
           t.apple_music_id, t.tidal_track_id, t.amazon_music_id, t.short_id,
           coalesce(l.n, 0) AS likers, coalesce(s.n, 0) AS saves, coalesce(r.n, 0) AS reactions, coalesce(o.n, 0) AS opens,
           (coalesce(l.n, 0) * 3 + coalesce(s.n, 0) * 4 + coalesce(r.n, 0) * 2 + least(coalesce(o.n, 0), 5))::int AS score,
           t.created_at
      FROM tracks t
      LEFT JOIN l ON l.track_id = t.id
      LEFT JOIN s ON s.track_id = t.id
      LEFT JOIN r ON r.track_id = t.id
      LEFT JOIN o ON o.track_id = t.id
     WHERE l.n IS NOT NULL OR s.n IS NOT NULL OR r.n IS NOT NULL OR o.n IS NOT NULL
  )
  SELECT id, title, artist, album, album_art_url, spotify_track_id, spotify_link_id, apple_music_id,
         tidal_track_id, amazon_music_id, short_id, likers, saves, reactions, opens, score
    FROM scored
   ORDER BY score DESC, likers DESC, created_at DESC
   LIMIT greatest(1, least(p_limit, 50));
$$;
GRANT EXECUTE ON FUNCTION public.trending_tracks(int, int) TO anon, authenticated;

-- ── 2. Music chart cache (Apple Music US top songs, refreshed by the refresh-charts function) ──
CREATE TABLE IF NOT EXISTS public.chart_tracks (
  chart text NOT NULL DEFAULT 'apple-us-top-songs',
  position int NOT NULL,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chart, position)
);
ALTER TABLE public.chart_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read charts" ON public.chart_tracks;
CREATE POLICY "Anyone can read charts" ON public.chart_tracks FOR SELECT USING (true);
-- (writes: server only)

-- ── 3. People suggestions ────────────────────────────────────────────────────
-- People the caller doesn't follow yet, ranked by liked songs in common (×3), artists in common
-- (×1) and mutual follows (×5), with a short human-readable reason.
CREATE OR REPLACE FUNCTION public.suggest_people(p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text, profile_color text, current_mood text,
  shared_songs int, shared_artists int, mutual_follows int, reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  candidates AS (
    SELECT p.* FROM profiles p, me
     WHERE me.uid IS NOT NULL AND p.id <> me.uid AND p.username IS NOT NULL
       AND coalesce(p.public, true)
       AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = me.uid AND f.following_id = p.id)
  ),
  my_tracks AS (SELECT DISTINCT lk.track_id FROM likes lk, me WHERE lk.user_id = me.uid),
  my_artists AS (
    SELECT DISTINCT lower(t.artist) AS a FROM likes lk JOIN tracks t ON t.id = lk.track_id, me
     WHERE lk.user_id = me.uid AND t.artist IS NOT NULL AND t.artist <> 'Unknown'
  ),
  shared_songs AS (
    SELECT lk.user_id, count(DISTINCT lk.track_id)::int AS n
      FROM likes lk JOIN my_tracks mt ON mt.track_id = lk.track_id
     GROUP BY lk.user_id
  ),
  shared_artists AS (
    SELECT lk.user_id, count(DISTINCT lower(t.artist))::int AS n
      FROM likes lk JOIN tracks t ON t.id = lk.track_id JOIN my_artists ma ON ma.a = lower(t.artist)
     GROUP BY lk.user_id
  ),
  mutual AS (
    SELECT f2.following_id AS user_id, count(*)::int AS n, min(p.username) AS via
      FROM follows f1
      JOIN follows f2 ON f2.follower_id = f1.following_id
      JOIN profiles p ON p.id = f1.following_id, me
     WHERE f1.follower_id = me.uid
     GROUP BY f2.following_id
  )
  SELECT c.id, c.username, c.display_name, c.avatar_url, c.profile_color, c.current_mood,
         coalesce(ss.n, 0), coalesce(sa.n, 0), coalesce(mu.n, 0),
         CASE
           WHEN coalesce(ss.n, 0) >= 3 THEN ss.n || ' songs in common'
           WHEN coalesce(mu.n, 0) >= 1 THEN 'followed by @' || mu.via || CASE WHEN mu.n > 1 THEN ' +' || (mu.n - 1) ELSE '' END
           WHEN coalesce(sa.n, 0) >= 2 THEN sa.n || ' artists in common'
           WHEN coalesce(ss.n, 0) >= 1 THEN ss.n || CASE WHEN ss.n = 1 THEN ' song' ELSE ' songs' END || ' in common'
           ELSE 'new on PLAI'
         END
    FROM candidates c
    LEFT JOIN shared_songs ss ON ss.user_id = c.id
    LEFT JOIN shared_artists sa ON sa.user_id = c.id
    LEFT JOIN mutual mu ON mu.user_id = c.id
   ORDER BY coalesce(ss.n, 0) * 3 + coalesce(sa.n, 0) + coalesce(mu.n, 0) * 5 DESC, c.created_at DESC
   LIMIT greatest(1, least(p_limit, 50));
$$;
REVOKE ALL ON FUNCTION public.suggest_people(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_people(int) TO authenticated;

-- ── 4. Journal: public sees published posts; admins write ────────────────────
DROP POLICY IF EXISTS "Anyone can view discover posts" ON public.discover_posts;
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.discover_posts;
CREATE POLICY "Anyone can view published posts" ON public.discover_posts
  FOR SELECT USING (status = 'published');
-- (admins see drafts through the policy below, which only signed-in users evaluate,
--  because is_admin() isn't executable by the anonymous role)
DROP POLICY IF EXISTS "Admins manage posts" ON public.discover_posts;
CREATE POLICY "Admins manage posts" ON public.discover_posts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 5. Release sync throttle (checked at most twice a day per person) ─────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS releases_synced_at timestamptz;
-- (not added to the public column grant — server-side only)
