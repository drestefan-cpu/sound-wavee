-- Taste match v2
-- Before: only songs both people liked, matched by exact PLAI song row, divided by average library
-- size. Artists didn't count, and the same recording synced from different apps (Spotify vs Tidal)
-- never matched — so real overlap showed as 0%.
-- Now:
--   • artists: how much of each person's listening goes to the same artists (share of songs per
--     artist, overlapped — fair between big and small libraries), featured artists split out
--   • songs: matched by ISRC, else by title + main artist, so the same song from any app counts
--   • score = 1 − e^(−6 × (0.7 × artist overlap + 0.3 × song overlap)), shown 0–100
--   • fewer than 10 songs on either side → "not enough music yet" instead of a misleading number
-- Hidden / removed songs are left out.

CREATE OR REPLACE FUNCTION public.taste_match_details(p_a uuid, p_b uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lib AS (
    SELECT l.user_id, t.id AS track_id, t.title, t.artist, t.album_art_url, t.short_id, t.isrc,
           t.spotify_track_id, t.spotify_link_id, t.apple_music_id, t.tidal_track_id, t.amazon_music_id,
           lower(trim(regexp_replace(t.title, '\s*[\(\[\-–].*$', ''))) AS ttl,
           lower(trim(split_part(regexp_replace(t.artist, '\s+(feat\.?|ft\.?|&|x|with)\s+', ',', 'gi'), ',', 1))) AS a1
      FROM likes l JOIN tracks t ON t.id = l.track_id
     WHERE l.user_id IN (p_a, p_b) AND NOT like_hidden_by_owner(l.user_id, l.track_id)
  ),
  songs AS (
    SELECT DISTINCT ON (user_id, k) user_id, k, track_id, title, artist, album_art_url, short_id,
           spotify_track_id, spotify_link_id, apple_music_id, tidal_track_id, amazon_music_id
      FROM (SELECT *, coalesce(isrc, ttl || '|' || a1) AS k FROM lib) s
     ORDER BY user_id, k, track_id
  ),
  artist_rows AS (
    SELECT user_id, lower(trim(x)) AS a, trim(x) AS display
      FROM lib, regexp_split_to_table(regexp_replace(artist, '\s+(feat\.?|ft\.?|&|x|with)\s+', ',', 'gi'), '\s*,\s*') x
  ),
  art AS (
    SELECT user_id, a, min(display) AS display, count(*)::numeric AS n
      FROM artist_rows WHERE a NOT IN ('', 'unknown', 'various artists') GROUP BY user_id, a
  ),
  prop AS (SELECT user_id, a, display, n, n / sum(n) OVER (PARTITION BY user_id) AS p FROM art),
  sizes AS (
    SELECT (SELECT count(*) FROM songs WHERE user_id = p_a) AS na,
           (SELECT count(*) FROM songs WHERE user_id = p_b) AS nb
  ),
  shared_songs AS (
    SELECT sa.track_id, sa.title, sa.artist, sa.album_art_url, sa.short_id, sa.spotify_track_id, sa.spotify_link_id,
           sa.apple_music_id, sa.tidal_track_id, sa.amazon_music_id
      FROM songs sa JOIN songs sb ON sb.k = sa.k AND sb.user_id = p_b
     WHERE sa.user_id = p_a
  ),
  shared_artists AS (
    SELECT x.display AS name, (x.n + y.n)::int AS songs, least(x.p, y.p) AS overlap
      FROM prop x JOIN prop y ON y.a = x.a AND y.user_id = p_b
     WHERE x.user_id = p_a
  ),
  calc AS (
    SELECT s.na, s.nb,
           coalesce((SELECT sum(overlap) FROM shared_artists), 0) AS artist_overlap,
           CASE WHEN least(s.na, s.nb) > 0
                THEN (SELECT count(*) FROM shared_songs)::numeric / least(s.na, s.nb) ELSE 0 END AS song_overlap
      FROM sizes s
  )
  SELECT jsonb_build_object(
    'enough', least(c.na, c.nb) >= 10,
    'score', CASE WHEN least(c.na, c.nb) >= 10
                  THEN round(100 * (1 - exp(-6 * (0.7 * c.artist_overlap + 0.3 * c.song_overlap))))::int END,
    'songs_a', c.na,
    'songs_b', c.nb,
    'shared_song_count', (SELECT count(*) FROM shared_songs),
    'shared_artist_count', (SELECT count(*) FROM shared_artists),
    'shared_artists', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'songs', songs) ORDER BY overlap DESC, songs DESC)
                                  FROM (SELECT * FROM shared_artists ORDER BY overlap DESC, songs DESC LIMIT 12) x), '[]'::jsonb),
    'shared_songs', coalesce((SELECT jsonb_agg(jsonb_build_object('track_id', track_id, 'title', title, 'artist', artist,
                                                              'album_art_url', album_art_url, 'short_id', short_id,
                                                              'spotify_track_id', spotify_track_id, 'spotify_link_id', spotify_link_id,
                                                              'apple_music_id', apple_music_id, 'tidal_track_id', tidal_track_id,
                                                              'amazon_music_id', amazon_music_id))
                                FROM (SELECT * FROM shared_songs LIMIT 12) x), '[]'::jsonb)
  )
  FROM calc c;
$$;
REVOKE ALL ON FUNCTION public.taste_match_details(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- The app's entry point: your match with someone else.
CREATE OR REPLACE FUNCTION public.my_taste_match(p_other uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() THEN NULL
              ELSE taste_match_details(auth.uid(), p_other) END;
$$;
REVOKE ALL ON FUNCTION public.my_taste_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_taste_match(uuid) TO authenticated;

-- Keep the stored scores (used elsewhere) on the same formula: refresh them now and nightly.
CREATE OR REPLACE FUNCTION public.refresh_taste_compatibility()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int;
BEGIN
  WITH pairs AS (
    SELECT DISTINCT least(follower_id, following_id) AS user_a, greatest(follower_id, following_id) AS user_b
      FROM follows WHERE follower_id IS NOT NULL AND following_id IS NOT NULL AND follower_id <> following_id
  ),
  scored AS (SELECT user_a, user_b, taste_match_details(user_a, user_b) AS d FROM pairs)
  INSERT INTO taste_compatibility (user_a, user_b, score, calculated_at)
  SELECT user_a, user_b, coalesce((d->>'score')::int, 0), now() FROM scored
  ON CONFLICT (user_a, user_b) DO UPDATE SET score = EXCLUDED.score, calculated_at = EXCLUDED.calculated_at;
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_taste_compatibility() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('refresh-taste-match-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-taste-match-nightly');
SELECT cron.schedule('refresh-taste-match-nightly', '20 4 * * *', $cron$SELECT public.refresh_taste_compatibility();$cron$);
