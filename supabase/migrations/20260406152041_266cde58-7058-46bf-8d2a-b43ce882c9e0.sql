
-- Add profile_color to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_color text DEFAULT '#080B12';

-- Recommendations table
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  track_id uuid NOT NULL,
  message text,
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can insert recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update own received recommendations"
  ON public.recommendations FOR UPDATE
  USING (auth.uid() = to_user_id);

-- Taste profiles table
CREATE TABLE IF NOT EXISTS public.taste_profiles (
  user_id uuid PRIMARY KEY,
  top_artists jsonb,
  top_tracks jsonb,
  activity_score integer,
  last_calculated timestamptz DEFAULT now()
);

ALTER TABLE public.taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view taste profiles"
  ON public.taste_profiles FOR SELECT
  USING (true);

-- Taste compatibility table
CREATE TABLE IF NOT EXISTS public.taste_compatibility (
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  score integer NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE (user_a, user_b)
);

ALTER TABLE public.taste_compatibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view taste compatibility"
  ON public.taste_compatibility FOR SELECT
  USING (true);
