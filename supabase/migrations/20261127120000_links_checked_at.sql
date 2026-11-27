-- When a song was last looked up on the other music apps (Spotify / Apple Music / Tidal), so syncs
-- don't re-check the same unmatched songs every 2 hours. Re-checked after 7 days.
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS links_checked_at timestamptz;
