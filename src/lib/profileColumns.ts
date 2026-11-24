/**
 * Profile columns anyone signed in (or not) may read. Must match the column grant in
 * supabase/migrations/20261124160000_lock_private_profile_columns.sql.
 * Private columns (music-account tokens, PIN, private ids) are only available for your
 * own profile via supabase.rpc("get_my_profile").
 */
export const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, created_at, current_mood, mood_set_at, profile_color, status, public, platform, preferred_platform, onboarding_complete, last_synced_at, sync_spotify, sync_apple_music, sync_tidal, sync_youtube";
