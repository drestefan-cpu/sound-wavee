CREATE TABLE IF NOT EXISTS public.collection_exclusions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, track_id)
);

ALTER TABLE public.collection_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view collection exclusions"
  ON public.collection_exclusions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own collection exclusions"
  ON public.collection_exclusions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collection exclusions"
  ON public.collection_exclusions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
