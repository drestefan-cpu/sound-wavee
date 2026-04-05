
-- Add onboarding_complete to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- Add foreign keys (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_follower_id_fkey') THEN
    ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_following_id_fkey') THEN
    ALTER TABLE public.follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_user_id_fkey') THEN
    ALTER TABLE public.likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_track_id_fkey') THEN
    ALTER TABLE public.likes ADD CONSTRAINT likes_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reactions_like_id_fkey') THEN
    ALTER TABLE public.reactions ADD CONSTRAINT reactions_like_id_fkey FOREIGN KEY (like_id) REFERENCES public.likes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reactions_user_id_fkey') THEN
    ALTER TABLE public.reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraints (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_track_unique ON public.likes(user_id, track_id);
CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_following_unique ON public.follows(follower_id, following_id);
CREATE UNIQUE INDEX IF NOT EXISTS reactions_like_user_emoji_unique ON public.reactions(like_id, user_id, emoji);
CREATE UNIQUE INDEX IF NOT EXISTS tracks_spotify_track_id_unique ON public.tracks(spotify_track_id);

-- Recreate the trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'user' || substr(NEW.id::text, 1, 8)), ' ', ''))
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
