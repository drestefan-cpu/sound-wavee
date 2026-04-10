CREATE TABLE IF NOT EXISTS public.user_followed_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_name text NOT NULL,
  follow_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_followed_artists_user_artist_unique
  ON public.user_followed_artists (user_id, lower(artist_name));

ALTER TABLE public.user_followed_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own followed artists"
  ON public.user_followed_artists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own followed artists"
  ON public.user_followed_artists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

INSERT INTO public.user_followed_artists (user_id, artist_name, follow_source)
SELECT DISTINCT ON (seed.user_id, lower(seed.artist_name))
  seed.user_id,
  seed.artist_name,
  seed.follow_source
FROM (
  SELECT
    l.user_id,
    t.artist AS artist_name,
    'backfill_like'::text AS follow_source,
    1 AS priority
  FROM public.likes l
  JOIN public.tracks t ON t.id = l.track_id
  WHERE t.artist IS NOT NULL AND btrim(t.artist) <> ''

  UNION ALL

  SELECT
    s.user_id,
    t.artist AS artist_name,
    'backfill_save'::text AS follow_source,
    0 AS priority
  FROM public.saved_tracks s
  JOIN public.tracks t ON t.id = s.track_id
  WHERE t.artist IS NOT NULL AND btrim(t.artist) <> ''
) AS seed
ORDER BY seed.user_id, lower(seed.artist_name), seed.priority
ON CONFLICT DO NOTHING;
