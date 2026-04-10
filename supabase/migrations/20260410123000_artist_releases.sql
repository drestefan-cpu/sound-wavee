CREATE TABLE IF NOT EXISTS public.artist_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name text NOT NULL,
  title text NOT NULL,
  album text,
  album_art_url text,
  spotify_track_id text,
  release_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS artist_releases_spotify_track_id_unique
  ON public.artist_releases (spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS artist_releases_artist_name_release_date_idx
  ON public.artist_releases (artist_name, release_date DESC);

ALTER TABLE public.artist_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artist releases"
  ON public.artist_releases FOR SELECT
  USING (true);

INSERT INTO public.artist_releases (
  artist_name,
  title,
  album,
  album_art_url,
  spotify_track_id,
  release_date
) VALUES
  (
    'Olivia Dean',
    'Man I Need',
    'Live at the Jazz Cafe',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
    '5enxwA8aAbwZbf5qCHORXi',
    '2026-04-09'
  ),
  (
    'Olivia Dean',
    'So Easy (To Fall In Love)',
    'The Art of Loving',
    'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=600&q=80',
    '4xpDQBOBmQgRzYGNIxFMdj',
    '2026-04-04'
  ),
  (
    'Alex Warren',
    'Ordinary',
    'Ordinary EP',
    'https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?auto=format&fit=crop&w=600&q=80',
    '3HWnxBS4RHnAzFpfOGsJXs',
    '2026-04-08'
  ),
  (
    'Teddy Swims',
    'Lose Control',
    'I''ve Tried Everything But Therapy (Part 1)',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
    '3YFDMNaGFvBMnHsOGrgaBl',
    '2026-04-02'
  ),
  (
    'Morgan Wallen',
    'Folded',
    'I''m the Problem',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80',
    '5oCFCBbal7N9RqM0HMpDaS',
    '2026-04-01'
  ),
  (
    'BTS',
    'SWIM',
    'SWIM - Single',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
    '68lbSrXDORS51pmyjZv712',
    '2026-04-10'
  ),
  (
    'ROSÉ & Bruno Mars',
    'APT.',
    'rosie',
    'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=600&q=80',
    '5vNRhJkzFHSEEhBVvkBGpM',
    '2026-03-30'
  ),
  (
    'Kendrick Lamar & SZA',
    'Luther',
    'GNX',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80',
    '5jnBTTNMBEAMJGFvSSzpNa',
    '2026-04-03'
  );
