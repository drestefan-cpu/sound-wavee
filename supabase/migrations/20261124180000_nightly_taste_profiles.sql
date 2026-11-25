-- Nightly taste profiles and taste-match scores, computed inside the database and scheduled with
-- pg_cron. Same logic as the old build-taste-profile edge function, but with no HTTP call or
-- service key involved.
--
--   taste_profiles:      per user — top 10 artists, top 10 tracks (from likes + saves + reactions)
--                         and an activity score (likes + saves + reactions)
--   taste_compatibility: per follow pair — shared liked songs ÷ average library size × 100

CREATE OR REPLACE FUNCTION public.rebuild_taste_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profiles int;
  v_pairs int;
BEGIN
  -- ── taste_profiles ──
  WITH activity AS (
    SELECT l.user_id, t.id AS track_id, t.artist, t.title, t.spotify_track_id
      FROM likes l JOIN tracks t ON t.id = l.track_id
    UNION ALL
    SELECT s.user_id, t.id, t.artist, t.title, t.spotify_track_id
      FROM saved_tracks s JOIN tracks t ON t.id = s.track_id
    UNION ALL
    SELECT r.user_id, t.id, t.artist, t.title, t.spotify_track_id
      FROM reactions r JOIN likes l ON l.id = r.like_id JOIN tracks t ON t.id = l.track_id
  ),
  artists AS (
    SELECT user_id, artist, count(*) AS n,
           row_number() OVER (PARTITION BY user_id ORDER BY count(*) DESC, artist) AS rk
      FROM activity WHERE artist IS NOT NULL
     GROUP BY user_id, artist
  ),
  tracks_ranked AS (
    SELECT user_id, coalesce(spotify_track_id, title) AS k,
           min(title) AS title, min(artist) AS artist, min(spotify_track_id) AS spotify_id, count(*) AS n,
           row_number() OVER (PARTITION BY user_id ORDER BY count(*) DESC, min(title)) AS rk
      FROM activity WHERE coalesce(spotify_track_id, title) IS NOT NULL
     GROUP BY user_id, coalesce(spotify_track_id, title)
  ),
  scores AS (
    SELECT p.id AS user_id,
           (SELECT count(*) FROM likes WHERE user_id = p.id)
         + (SELECT count(*) FROM saved_tracks WHERE user_id = p.id)
         + (SELECT count(*) FROM reactions WHERE user_id = p.id) AS activity_score
      FROM profiles p
  )
  INSERT INTO taste_profiles (user_id, top_artists, top_tracks, activity_score, last_calculated)
  SELECT s.user_id,
         coalesce((SELECT jsonb_agg(jsonb_build_object('name', a.artist, 'count', a.n) ORDER BY a.rk)
                     FROM artists a WHERE a.user_id = s.user_id AND a.rk <= 10), '[]'::jsonb),
         coalesce((SELECT jsonb_agg(jsonb_build_object('count', tr.n, 'title', tr.title, 'artist', tr.artist, 'spotify_id', tr.spotify_id) ORDER BY tr.rk)
                     FROM tracks_ranked tr WHERE tr.user_id = s.user_id AND tr.rk <= 10), '[]'::jsonb),
         s.activity_score,
         now()
    FROM scores s
  ON CONFLICT (user_id) DO UPDATE
    SET top_artists = EXCLUDED.top_artists,
        top_tracks = EXCLUDED.top_tracks,
        activity_score = EXCLUDED.activity_score,
        last_calculated = EXCLUDED.last_calculated;
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  -- ── taste_compatibility (one row per follow pair, smaller id first) ──
  WITH pairs AS (
    SELECT DISTINCT least(follower_id, following_id) AS user_a, greatest(follower_id, following_id) AS user_b
      FROM follows
     WHERE follower_id IS NOT NULL AND following_id IS NOT NULL AND follower_id <> following_id
  ),
  sizes AS (
    SELECT user_id, count(DISTINCT track_id) AS n FROM likes GROUP BY user_id
  ),
  shared AS (
    SELECT p.user_a, p.user_b, count(DISTINCT la.track_id) AS n
      FROM pairs p
      JOIN likes la ON la.user_id = p.user_a
      JOIN likes lb ON lb.user_id = p.user_b AND lb.track_id = la.track_id
     GROUP BY p.user_a, p.user_b
  )
  INSERT INTO taste_compatibility (user_a, user_b, score, calculated_at)
  SELECT p.user_a, p.user_b,
         round(coalesce(sh.n, 0)::numeric / ((sa.n + sb.n) / 2.0) * 100)::int,
         now()
    FROM pairs p
    JOIN sizes sa ON sa.user_id = p.user_a
    JOIN sizes sb ON sb.user_id = p.user_b
    LEFT JOIN shared sh ON sh.user_a = p.user_a AND sh.user_b = p.user_b
  ON CONFLICT (user_a, user_b) DO UPDATE
    SET score = EXCLUDED.score, calculated_at = EXCLUDED.calculated_at;
  GET DIAGNOSTICS v_pairs = ROW_COUNT;

  RETURN jsonb_build_object('profiles', v_profiles, 'pairs', v_pairs, 'at', now());
END;
$$;

-- Only the scheduler / server may run it
REVOKE ALL ON FUNCTION public.rebuild_taste_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_taste_profiles() TO service_role;

-- Every night at 04:00 UTC (11pm US Eastern), after the 03:00 cleanup job
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rebuild-taste-profiles-nightly';
SELECT cron.schedule('rebuild-taste-profiles-nightly', '0 4 * * *', $cron$SELECT public.rebuild_taste_profiles();$cron$);
