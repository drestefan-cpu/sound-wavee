-- Releases grouped by project: remember which album/EP/single each release track belongs to.
ALTER TABLE public.artist_releases
  ADD COLUMN IF NOT EXISTS spotify_album_id text,
  ADD COLUMN IF NOT EXISTS album_type text,
  ADD COLUMN IF NOT EXISTS total_tracks int;
CREATE INDEX IF NOT EXISTS artist_releases_album_idx ON public.artist_releases (spotify_album_id);
