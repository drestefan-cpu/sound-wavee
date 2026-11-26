-- Expired music-app connections, from the background sync's log, so the app can say
-- "your Spotify connection expired — reconnect" instead of silently showing nothing new.

-- A sync result that means the person has to sign in to that app again
CREATE OR REPLACE FUNCTION public.sync_needs_reconnect(p_status int, p_detail text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_status IN (401, 403)
      OR coalesce(p_detail, '') ~* '"reconnect"\s*:\s*true|expired|invalid_grant|revoked|API 401|Request had invalid authentication';
$$;

-- Your apps whose latest background sync (last 7 days) failed for that reason, if still connected
CREATE OR REPLACE FUNCTION public.my_connection_issues()
RETURNS TABLE (platform text, since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (s.platform) s.platform, s.status, s.detail, s.created_at
      FROM sync_log s
     WHERE s.user_id = auth.uid() AND s.created_at > now() - interval '7 days'
     ORDER BY s.platform, s.created_at DESC
  )
  SELECT l.platform, l.created_at
    FROM latest l JOIN profiles p ON p.id = auth.uid()
   WHERE sync_needs_reconnect(l.status, l.detail)
     AND CASE l.platform
           WHEN 'spotify' THEN p.spotify_refresh_token IS NOT NULL
           WHEN 'apple-music' THEN p.apple_music_user_token IS NOT NULL
           WHEN 'tidal' THEN p.tidal_refresh_token IS NOT NULL
           WHEN 'youtube' THEN p.youtube_refresh_token IS NOT NULL
           ELSE false
         END;
$$;
REVOKE ALL ON FUNCTION public.my_connection_issues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_connection_issues() TO authenticated;

-- Called right after someone reconnects an app, so the notice goes away straight away
CREATE OR REPLACE FUNCTION public.clear_connection_issue(p_platform text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM sync_log WHERE user_id = auth.uid() AND platform = p_platform;
$$;
REVOKE ALL ON FUNCTION public.clear_connection_issue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_connection_issue(text) TO authenticated;
