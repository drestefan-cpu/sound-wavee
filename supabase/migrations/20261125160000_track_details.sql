-- Song details for the track screen (credits, release info, 30-second preview), cached per song.
-- Filled by the track-details function from Apple Music, MusicBrainz and Spotify.
CREATE TABLE IF NOT EXISTS public.track_details (
  track_id uuid PRIMARY KEY REFERENCES public.tracks(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  credits_complete boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.track_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read track details" ON public.track_details;
CREATE POLICY "Anyone can read track details" ON public.track_details FOR SELECT USING (true);
-- (writes: server only)
