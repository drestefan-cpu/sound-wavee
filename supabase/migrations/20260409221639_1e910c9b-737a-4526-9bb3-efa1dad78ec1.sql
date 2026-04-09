CREATE TABLE IF NOT EXISTS public.hidden_tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, track_id)
);

ALTER TABLE public.hidden_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hidden tracks"
  ON public.hidden_tracks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hidden tracks"
  ON public.hidden_tracks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hidden tracks"
  ON public.hidden_tracks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);