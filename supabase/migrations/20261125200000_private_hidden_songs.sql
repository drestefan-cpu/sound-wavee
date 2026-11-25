-- Hidden songs stay private. Previously any signed-in person could read anyone's hidden_tracks /
-- collection_exclusions lists (the app needed them to leave those songs out of profiles and
-- feeds). Now the database leaves them out itself: other people simply don't receive likes the
-- owner hid or removed, and only the owner can read their own lists.

-- True when the owner hid or removed this song from their collection.
-- SECURITY DEFINER so the check works for every viewer without exposing the lists themselves.
CREATE OR REPLACE FUNCTION public.like_hidden_by_owner(p_user_id uuid, p_track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM hidden_tracks h WHERE h.user_id = p_user_id AND h.track_id = p_track_id)
      OR EXISTS (SELECT 1 FROM collection_exclusions c WHERE c.user_id = p_user_id AND c.track_id = p_track_id);
$$;
REVOKE ALL ON FUNCTION public.like_hidden_by_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.like_hidden_by_owner(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "public read likes" ON public.likes;
CREATE POLICY "public read likes" ON public.likes
  FOR SELECT USING (
    user_id = auth.uid() OR NOT public.like_hidden_by_owner(user_id, track_id)
  );

DROP POLICY IF EXISTS "Signed-in users can view hidden tracks" ON public.hidden_tracks;
CREATE POLICY "Users can view own hidden tracks" ON public.hidden_tracks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view collection exclusions" ON public.collection_exclusions;
CREATE POLICY "Users can view own collection exclusions" ON public.collection_exclusions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
