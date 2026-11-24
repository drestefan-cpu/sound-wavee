-- Lock private profile columns (applied after the app stopped using select("*") on profiles).
-- OAuth tokens, PIN and private ids become unreadable to anon/authenticated; the app reads its own
-- private columns only through get_my_profile(). Edge functions use the service role and are unaffected.

-- ── 1. Profiles: only public columns are readable by anon/authenticated ────────
-- (Postgres ignores a column-level REVOKE while a table-level grant exists, which is why the
--  June "security fixes" migration had no effect. Revoke the table grant, then grant columns.)
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, created_at,
  current_mood, mood_set_at, profile_color, status, public,
  platform, preferred_platform, onboarding_complete, last_synced_at,
  sync_spotify, sync_apple_music, sync_tidal, sync_youtube
) ON public.profiles TO anon, authenticated;
-- Private (server/own-profile only, via get_my_profile()): spotify/tidal/youtube tokens,
-- apple_music_user_token, apple_music_token, login_pin, spotify_id, tidal_user_id,
-- youtube_user_id, apple_music_user_id, plai_playlist_id, spotify_backfilled_at.
