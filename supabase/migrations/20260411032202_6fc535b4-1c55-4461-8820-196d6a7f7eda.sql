ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_mood text,
ADD COLUMN IF NOT EXISTS mood_set_at timestamptz;