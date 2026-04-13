CREATE TABLE IF NOT EXISTS public.discover_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  cover_image_url text,
  body_markdown text,
  post_type text NOT NULL CHECK (post_type IN ('internal', 'external')),
  external_url text,
  author_name text,
  published_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discover_posts_internal_body_check CHECK (
    (post_type = 'internal' AND body_markdown IS NOT NULL)
    OR post_type = 'external'
  ),
  CONSTRAINT discover_posts_external_url_check CHECK (
    (post_type = 'external' AND external_url IS NOT NULL)
    OR post_type = 'internal'
  )
);

CREATE INDEX IF NOT EXISTS discover_posts_status_published_at_idx
  ON public.discover_posts (status, published_at DESC);

ALTER TABLE public.discover_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discover posts"
  ON public.discover_posts FOR SELECT
  USING (true);

INSERT INTO public.discover_posts (
  slug,
  title,
  excerpt,
  cover_image_url,
  body_markdown,
  post_type,
  external_url,
  author_name,
  published_at,
  status
) VALUES
  (
    'three-soft-launch-signals',
    '3 signals a release is landing before the timeline catches up',
    'A quick editorial note on the quiet clues that make a new release feel inevitable.',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    '# Listen before the discourse arrives

Some releases show up in the culture before they show up in the charts.

## What PLAI is watching

- repeat saves from the same circle
- early shares without captions
- songs that keep reappearing across moods

These are not big public signals. They are the softer social ones.

## Why it matters

The best discovery products should notice momentum before it becomes obvious.',
    'internal',
    null,
    'PLAI',
    now() - interval '2 days',
    'published'
  ),
  (
    'april-discovery-loop',
    'April discovery loop',
    'A playlist-sized exit ramp from the feed: warm synths, late-night R&B, and soft-focus pop.',
    'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1200&q=80',
    null,
    'external',
    'https://open.spotify.com/',
    'PLAI',
    now() - interval '1 day',
    'published'
  )
ON CONFLICT (slug) DO NOTHING;
