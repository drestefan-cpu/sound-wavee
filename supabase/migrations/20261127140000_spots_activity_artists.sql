-- 1. Spotify spots: Spotify's development mode lets 5 people connect. When they're taken, the app
--    sends new Spotify people straight to "join with a playlist". Counted from connected accounts,
--    with an admin switch to mark it full by hand.
-- 2. Song activity on PLAI (for the song screen): people who love it, reactions, plays from links.
-- 3. Cache for the artist section of the song screen (photos, releases, bio, socials).

CREATE TABLE IF NOT EXISTS public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.spotify_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH used AS (SELECT count(*)::int AS n FROM profiles WHERE spotify_refresh_token IS NOT NULL),
  manual AS (SELECT (value->>'full')::boolean AS is_full FROM app_settings WHERE key = 'spotify_spots')
  SELECT jsonb_build_object(
    'used', (SELECT n FROM used), 'limit', 5,
    'manual', (SELECT is_full FROM manual),
    'full', coalesce((SELECT is_full FROM manual), (SELECT n FROM used) >= 5)
  );
$$;
REVOKE ALL ON FUNCTION public.spotify_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spotify_status() TO anon, authenticated;

-- p_full: true = full, false = open, null = automatic
CREATE OR REPLACE FUNCTION public.admin_set_spotify_full(p_full boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admins only'; END IF;
  IF p_full IS NULL THEN
    DELETE FROM app_settings WHERE key = 'spotify_spots';
  ELSE
    INSERT INTO app_settings (key, value) VALUES ('spotify_spots', jsonb_build_object('full', p_full))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_spotify_full(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_spotify_full(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.track_activity(p_track_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'loved', (SELECT count(DISTINCT u) FROM (
                SELECT l.user_id u FROM likes l WHERE l.track_id = p_track_id AND NOT like_hidden_by_owner(l.user_id, l.track_id)
                UNION SELECT s.user_id FROM saved_tracks s WHERE s.track_id = p_track_id) x),
    'reactions', (SELECT count(*) FROM reactions r JOIN likes l ON l.id = r.like_id
                   WHERE l.track_id = p_track_id AND NOT like_hidden_by_owner(l.user_id, l.track_id)),
    'plays', (SELECT count(*) FROM share_opens o WHERE o.track_id = p_track_id),
    'sent', (SELECT count(*) FROM recommendations rc WHERE rc.track_id = p_track_id)
  );
$$;
REVOKE ALL ON FUNCTION public.track_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_activity(uuid) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.artist_details (
  artist_key text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artist_details FROM anon, authenticated;
