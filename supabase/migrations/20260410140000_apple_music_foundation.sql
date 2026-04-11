ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS apple_music_user_token text;

ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS apple_music_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tracks_apple_music_id_key
ON public.tracks (apple_music_id)
WHERE apple_music_id IS NOT NULL;
