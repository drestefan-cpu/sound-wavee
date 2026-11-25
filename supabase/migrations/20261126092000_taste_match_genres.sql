-- Taste match v3: adds genres (from Apple Music) and smarter artist splitting.
--   score = 1 − e^(−6 × (0.55 × artist overlap + 0.15 × genre overlap + 0.30 × song overlap))
--   • artists split with split_artists() ("Tyler, The Creator" stays whole; collabs split)
--   • genres: share of each person's songs per main genre, overlapped (genres are broad, so a
--     smaller weight — otherwise everyone who likes pop would match highly)
CREATE OR REPLACE FUNCTION public.taste_match_details(p_a uuid, p_b uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lib AS (
    SELECT l.user_id, t.id AS track_id, t.title, t.artist, t.album_art_url, t.short_id, t.isrc, t.genres[1] AS genre,
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
    SELECT user_id, lower(x) AS a, x AS display FROM lib, unnest(split_artists(artist)) x
  ),
  art AS (
    SELECT user_id, a, min(display) AS display, count(*)::numeric AS n
      FROM artist_rows WHERE a NOT IN ('', 'unknown', 'various artists') GROUP BY user_id, a
  ),
  prop AS (SELECT user_id, a, display, n, n / sum(n) OVER (PARTITION BY user_id) AS p FROM art),
  -- genres: each person's share of songs per main genre (Apple Music), overlapped like artists
  gen AS (SELECT user_id, genre, count(*)::numeric AS n FROM lib WHERE genre IS NOT NULL GROUP BY user_id, genre),
  gprop AS (SELECT user_id, genre, n / sum(n) OVER (PARTITION BY user_id) AS p FROM gen),
  shared_genres AS (
    SELECT x.genre AS name, least(x.p, y.p) AS overlap
      FROM gprop x JOIN gprop y ON y.genre = x.genre AND y.user_id = p_b
     WHERE x.user_id = p_a
  ),
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
           coalesce((SELECT sum(overlap) FROM shared_genres), 0) AS genre_overlap,
           CASE WHEN least(s.na, s.nb) > 0
                THEN (SELECT count(*) FROM shared_songs)::numeric / least(s.na, s.nb) ELSE 0 END AS song_overlap
      FROM sizes s
  )
  SELECT jsonb_build_object(
    'enough', least(c.na, c.nb) >= 10,
    'score', CASE WHEN least(c.na, c.nb) >= 10
                  THEN round(100 * (1 - exp(-6 * (0.55 * c.artist_overlap + 0.15 * c.genre_overlap + 0.30 * c.song_overlap))))::int END,
    'songs_a', c.na,
    'songs_b', c.nb,
    'shared_song_count', (SELECT count(*) FROM shared_songs),
    'shared_artist_count', (SELECT count(*) FROM shared_artists),
    'shared_genres', coalesce((SELECT jsonb_agg(name ORDER BY overlap DESC) FROM (SELECT * FROM shared_genres ORDER BY overlap DESC LIMIT 4) g), '[]'::jsonb),
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

SELECT public.refresh_taste_compatibility();
