-- Taste match % for everyone you follow or who follows you (shown in your following / followers list).
CREATE OR REPLACE FUNCTION public.my_friend_matches()
RETURNS TABLE (user_id uuid, score int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH friends AS (
    SELECT following_id AS uid FROM follows WHERE follower_id = auth.uid()
    UNION
    SELECT follower_id FROM follows WHERE following_id = auth.uid()
  )
  SELECT f.uid, (taste_match_details(auth.uid(), f.uid)->>'score')::int
    FROM friends f
   WHERE auth.uid() IS NOT NULL AND f.uid <> auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_friend_matches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_friend_matches() TO authenticated;
