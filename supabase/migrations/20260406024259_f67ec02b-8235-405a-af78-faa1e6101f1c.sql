ALTER TABLE public.saved_tracks 
ADD COLUMN IF NOT EXISTS source_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS source_context text DEFAULT 'feed';