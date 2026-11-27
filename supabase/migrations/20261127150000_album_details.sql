-- Cache for the release screen (tracklist, label, links on each app), per Apple Music album.
CREATE TABLE IF NOT EXISTS public.album_details (
  apple_album_id text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.album_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.album_details FROM anon, authenticated;
