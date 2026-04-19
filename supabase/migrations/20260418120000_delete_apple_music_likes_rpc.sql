-- Creates a reliable server-side function to delete all Apple Music likes for a user.
-- Used by the disconnect button in Settings and the sync function cleanup step.
-- SECURITY DEFINER so it can be called from both the frontend (anon key) and edge functions (service role).
CREATE OR REPLACE FUNCTION delete_apple_music_likes(p_user_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM likes
  WHERE user_id = p_user_id
    AND track_id IN (
      SELECT id FROM tracks WHERE spotify_track_id LIKE 'apple:%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
