-- Security hardening (2026-11-24)
-- 1. Plain-text PIN cleared (the column lock itself is in 20261124160000, applied after the app update).
-- 2. Row-level security on every table that had it switched off.
-- 3. Real admin roles (app_admins) instead of a PIN in the app.
-- 4. Radar invites redeemed through a checked function.
-- 5. Fix delete_apple_music_likes letting signed-out callers through; users can delete their own likes.

-- The old plain-text PIN column was never used for sign-in; clear it.
UPDATE public.profiles SET login_pin = NULL WHERE login_pin IS NOT NULL;

-- ── 2. Admins ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
-- No policies: nobody can read or change the admin list from the app.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- First admin: the project owner
INSERT INTO public.app_admins (user_id)
SELECT id FROM public.profiles WHERE username = 'dre.stefan'
ON CONFLICT DO NOTHING;

-- ── 3. Row-level security on tables that had it off ─────────────────────────

-- hidden_tracks: signed-in users can see hidden songs (to filter friends' collections); only owners change theirs
ALTER TABLE public.hidden_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own hidden tracks" ON public.hidden_tracks;
DROP POLICY IF EXISTS "Signed-in users can view hidden tracks" ON public.hidden_tracks;
CREATE POLICY "Signed-in users can view hidden tracks" ON public.hidden_tracks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own hidden tracks" ON public.hidden_tracks;
CREATE POLICY "Users can insert own hidden tracks" ON public.hidden_tracks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own hidden tracks" ON public.hidden_tracks;
CREATE POLICY "Users can delete own hidden tracks" ON public.hidden_tracks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- recommendations: visible to sender and recipient; sender creates; recipient marks seen
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own recommendations" ON public.recommendations;
CREATE POLICY "Users can view their own recommendations" ON public.recommendations
  FOR SELECT TO authenticated USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);
DROP POLICY IF EXISTS "Users can insert recommendations" ON public.recommendations;
CREATE POLICY "Users can insert recommendations" ON public.recommendations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
DROP POLICY IF EXISTS "Users can update own received recommendations" ON public.recommendations;
CREATE POLICY "Users can update own received recommendations" ON public.recommendations
  FOR UPDATE TO authenticated USING (auth.uid() = to_user_id) WITH CHECK (auth.uid() = to_user_id);

-- search_queries / track_views / profile_views: write your own, read your own
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own searches" ON public.search_queries;
CREATE POLICY "Users log own searches" ON public.search_queries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own searches" ON public.search_queries;
CREATE POLICY "Users read own searches" ON public.search_queries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.track_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own track views" ON public.track_views;
CREATE POLICY "Users log own track views" ON public.track_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own track views" ON public.track_views;
CREATE POLICY "Users read own track views" ON public.track_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own profile views" ON public.profile_views;
CREATE POLICY "Users log own profile views" ON public.profile_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
DROP POLICY IF EXISTS "Users read views of and by themselves" ON public.profile_views;
CREATE POLICY "Users read views of and by themselves" ON public.profile_views
  FOR SELECT TO authenticated USING (auth.uid() = viewer_id OR auth.uid() = profile_id);

-- taglines: everyone reads; admins edit
ALTER TABLE public.taglines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read taglines" ON public.taglines;
CREATE POLICY "public read taglines" ON public.taglines FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage taglines" ON public.taglines;
CREATE POLICY "Admins manage taglines" ON public.taglines
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- plai_picks: everyone reads; admins edit
DROP POLICY IF EXISTS "Admins manage plai_picks" ON public.plai_picks;
CREATE POLICY "Admins manage plai_picks" ON public.plai_picks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- taste data: signed-in users read (existing policies); only the server writes
ALTER TABLE public.taste_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taste_compatibility ENABLE ROW LEVEL SECURITY;

-- share_opens: analytics written by the log-share-open function (service role); not readable from the app
DROP POLICY IF EXISTS "Anyone can view share opens" ON public.share_opens;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'share_opens' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.share_opens', pol.policyname);
  END LOOP;
END $$;

-- likes: users can remove their own likes ("remove from collection")
DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" ON public.likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 4. Radar invites: redeem through a checked function ──────────────────────
-- Previously any signed-in user could list every invite code and grant themselves access.
DROP POLICY IF EXISTS "Authenticated can view radar invites" ON public.radar_invites;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'radar_invites' LOOP
    EXECUTE format('DROP POLICY %I ON public.radar_invites', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'radar_access' AND cmd = 'INSERT' LOOP
    EXECUTE format('DROP POLICY %I ON public.radar_access', pol.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_radar_invite(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM radar_access WHERE user_id = auth.uid()) THEN
    RETURN true;
  END IF;
  SELECT id, used INTO v_invite FROM radar_invites WHERE code = lower(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR v_invite.used THEN
    RETURN false;
  END IF;
  INSERT INTO radar_access (user_id, invite_id) VALUES (auth.uid(), v_invite.id);
  UPDATE radar_invites SET used = true, used_by = auth.uid() WHERE id = v_invite.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_radar_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_radar_invite(text) TO authenticated;

-- ── 5. delete_apple_music_likes: signed-out callers were let through ─────────
CREATE OR REPLACE FUNCTION public.delete_apple_music_likes(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Allowed: the server (service role), or a signed-in user deleting their own likes
  IF coalesce(auth.role(), '') <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM likes
  WHERE user_id = p_user_id
    AND track_id IN (SELECT id FROM tracks WHERE spotify_track_id LIKE 'apple:%');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_apple_music_likes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_apple_music_likes(uuid) TO authenticated, service_role;

-- get_my_profile is the only way the app reads its own private columns
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
