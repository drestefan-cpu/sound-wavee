-- Spotify playlist fallback: a public Spotify playlist synced as someone's collection, for people who
-- can't connect Spotify (PLAI's Spotify app is in development mode). Private columns: read through
-- get_my_profile, written only by the spotify-playlist function.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spotify_playlist_id text,
  ADD COLUMN IF NOT EXISTS spotify_playlist_name text,
  ADD COLUMN IF NOT EXISTS spotify_playlist_synced_at timestamptz;
