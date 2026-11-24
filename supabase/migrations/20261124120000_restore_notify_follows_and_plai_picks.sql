-- Restore two tables the app uses that were dropped from production at some point.
-- (Recorded as applied in the remote history for 20260411225704 / 20260407002244, but missing live.)

-- ── user_notify_follows: the bell button on other people's profiles ──────────
CREATE TABLE IF NOT EXISTS public.user_notify_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, target_user_id)
);

ALTER TABLE public.user_notify_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notify follows" ON public.user_notify_follows;
CREATE POLICY "Users can view own notify follows"
  ON public.user_notify_follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can insert own notify follows" ON public.user_notify_follows;
CREATE POLICY "Users can insert own notify follows"
  ON public.user_notify_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete own notify follows" ON public.user_notify_follows;
CREATE POLICY "Users can delete own notify follows"
  ON public.user_notify_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- ── plai_picks: admin-curated picks (read publicly; written from the dashboard) ──
CREATE TABLE IF NOT EXISTS public.plai_picks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position integer NOT NULL,
  spotify_track_id text,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  album_art_url text,
  note text,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plai_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read plai_picks" ON public.plai_picks;
CREATE POLICY "public read plai_picks"
  ON public.plai_picks FOR SELECT
  USING (true);
