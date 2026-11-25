-- Genres per song (from Apple Music), used by taste match. NULL = not looked up yet; '{}' = none found.
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS genres text[];

-- Liked songs that still need a genre lookup (server-only helper for fill-genres)
CREATE OR REPLACE FUNCTION public.tracks_needing_genres(p_limit int DEFAULT 1500)
RETURNS TABLE (id uuid, apple_id text, isrc text, title text, artist text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id,
         coalesce(t.apple_music_id, CASE WHEN t.spotify_track_id LIKE 'apple:%' THEN substr(t.spotify_track_id, 7) END),
         t.isrc, t.title, t.artist
    FROM tracks t
   WHERE t.genres IS NULL AND EXISTS (SELECT 1 FROM likes l WHERE l.track_id = t.id)
   LIMIT greatest(1, least(p_limit, 3000));
$$;
REVOKE ALL ON FUNCTION public.tracks_needing_genres(int) FROM PUBLIC, anon, authenticated;
