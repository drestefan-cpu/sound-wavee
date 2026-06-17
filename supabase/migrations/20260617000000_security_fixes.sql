-- Security fixes for Supabase advisor warnings

-- 1. Fix delete_apple_music_likes: reject calls from other authenticated users
--    NULL auth.uid() = service_role (allowed), matching uid = own user (allowed)
CREATE OR REPLACE FUNCTION delete_apple_music_likes(p_user_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM likes
  WHERE user_id = p_user_id
    AND track_id IN (
      SELECT id FROM tracks WHERE spotify_track_id LIKE 'apple:%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 2. Tighten notifications INSERT: actor must be the calling user
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 3. Restrict OAuth token columns from other users
--    SELECT * on profiles still works but excludes these columns for non-owners
REVOKE SELECT (
  spotify_access_token,
  spotify_refresh_token,
  tidal_access_token,
  tidal_refresh_token,
  apple_music_user_token,
  youtube_access_token,
  youtube_refresh_token
) ON public.profiles FROM authenticated, anon;

-- 4. Safe function to read own full profile (including token columns)
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT * FROM profiles WHERE id = auth.uid(); $$;

GRANT EXECUTE ON FUNCTION get_my_profile() TO authenticated;

-- 5. Tighten taste_profiles and taste_compatibility to authenticated only
DROP POLICY IF EXISTS "Anyone can view taste profiles" ON public.taste_profiles;
CREATE POLICY "Authenticated can view taste profiles"
  ON public.taste_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view taste compatibility" ON public.taste_compatibility;
CREATE POLICY "Authenticated can view taste compatibility"
  ON public.taste_compatibility FOR SELECT
  TO authenticated
  USING (true);
