-- Records when a user's full Spotify Liked Songs history was first read.
-- Older sync versions only imported the newest 50 songs; while this is NULL the sync
-- reads further back (up to 1,000 songs) instead of stopping at the newest known like.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotify_backfilled_at timestamptz;
