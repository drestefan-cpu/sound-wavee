
-- Add public column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public boolean NOT NULL DEFAULT true;

-- Create saved_tracks table
CREATE TABLE IF NOT EXISTS public.saved_tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);

-- Enable RLS
ALTER TABLE public.saved_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view saved tracks" ON public.saved_tracks FOR SELECT USING (true);
CREATE POLICY "Users can insert own saved tracks" ON public.saved_tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved tracks" ON public.saved_tracks FOR DELETE TO authenticated USING (auth.uid() = user_id);
