-- Friday recap: "your week on PLAI". Built every Friday evening for everyone who had a week
-- (liked songs, got reactions, or friends added music), shown as a card on the friends feed
-- for 3 days, listed in notifications, and pushed to phones that have notifications on.

CREATE TABLE IF NOT EXISTS public.weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_recaps FROM anon;
REVOKE INSERT, DELETE ON public.weekly_recaps FROM authenticated;
DROP POLICY IF EXISTS "recaps: own" ON public.weekly_recaps;
CREATE POLICY "recaps: own" ON public.weekly_recaps FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "recaps: dismiss own" ON public.weekly_recaps;
CREATE POLICY "recaps: dismiss own" ON public.weekly_recaps FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE UPDATE ON public.weekly_recaps FROM authenticated;
GRANT UPDATE (dismissed) ON public.weekly_recaps TO authenticated;

-- One person's last 7 days
CREATE OR REPLACE FUNCTION public.build_weekly_recap(p_user uuid, p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_liked int;
  v_top_artist text;
  v_top_artist_n int;
  v_reactions int;
  v_top_emoji text;
  v_saves int;
  v_received int;
  v_friend_songs int;
  v_top_friend jsonb;
  v_shared jsonb;
BEGIN
  -- songs you liked
  SELECT count(*) INTO v_liked FROM likes WHERE user_id = p_user AND coalesce(liked_at, created_at) >= p_since;

  -- your most-liked artist this week (main artist of each song; needs 2+ songs to count)
  SELECT a, n INTO v_top_artist, v_top_artist_n FROM (
    SELECT (split_artists(t.artist))[1] a, count(*) n
      FROM likes l JOIN tracks t ON t.id = l.track_id
     WHERE l.user_id = p_user AND coalesce(l.liked_at, l.created_at) >= p_since
     GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1
  ) x WHERE n >= 2;

  -- reactions friends left on your songs
  SELECT count(*), mode() WITHIN GROUP (ORDER BY r.emoji) INTO v_reactions, v_top_emoji
    FROM reactions r JOIN likes l ON l.id = r.like_id
   WHERE l.user_id = p_user AND r.user_id <> p_user AND r.created_at >= p_since;

  -- songs people saved from you
  SELECT count(*) INTO v_saves FROM saved_tracks
   WHERE source_user_id = p_user AND user_id <> p_user AND saved_at >= p_since;

  -- songs friends sent you
  SELECT count(*) INTO v_received FROM recommendations WHERE to_user_id = p_user AND created_at >= p_since;

  -- music from people you follow (not songs they hid)
  SELECT count(*) INTO v_friend_songs
    FROM likes l JOIN follows f ON f.following_id = l.user_id AND f.follower_id = p_user
   WHERE coalesce(l.liked_at, l.created_at) >= p_since AND NOT like_hidden_by_owner(l.user_id, l.track_id);

  SELECT jsonb_build_object('username', p.username, 'name', coalesce(p.display_name, p.username), 'count', x.n)
    INTO v_top_friend
    FROM (
      SELECT l.user_id, count(*) n
        FROM likes l JOIN follows f ON f.following_id = l.user_id AND f.follower_id = p_user
       WHERE coalesce(l.liked_at, l.created_at) >= p_since AND NOT like_hidden_by_owner(l.user_id, l.track_id)
       GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    ) x JOIN profiles p ON p.id = x.user_id
   WHERE p.username IS NOT NULL;

  -- a song you liked this week that people you follow also love
  SELECT jsonb_build_object('title', t.title, 'artist', t.artist, 'track_id', t.id,
                            'friends', (array_agg(DISTINCT coalesce(p.display_name, p.username)))[1:3])
    INTO v_shared
    FROM likes mine
    JOIN tracks t ON t.id = mine.track_id
    JOIN likes theirs ON theirs.track_id = mine.track_id AND theirs.user_id <> p_user
                     AND NOT like_hidden_by_owner(theirs.user_id, theirs.track_id)
    JOIN follows f ON f.follower_id = p_user AND f.following_id = theirs.user_id
    JOIN profiles p ON p.id = theirs.user_id AND p.username IS NOT NULL
   WHERE mine.user_id = p_user AND coalesce(mine.liked_at, mine.created_at) >= p_since
   GROUP BY t.id, t.title, t.artist
   ORDER BY count(*) DESC, max(theirs.created_at) DESC
   LIMIT 1;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'liked', v_liked,
    'top_artist', v_top_artist,
    'top_artist_count', v_top_artist_n,
    'reactions', v_reactions,
    'top_emoji', v_top_emoji,
    'saves', v_saves,
    'received', v_received,
    'friend_songs', v_friend_songs,
    'top_friend', v_top_friend,
    'shared', v_shared
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.build_weekly_recap(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Everyone's recap, plus a notification (which also pushes to phones with notifications on)
CREATE OR REPLACE FUNCTION public.generate_weekly_recaps()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user record;
  v_data jsonb;
  v_week date := (now() AT TIME ZONE 'utc')::date - 6;
  v_made int := 0;
  v_body text;
BEGIN
  FOR v_user IN SELECT id FROM profiles WHERE username IS NOT NULL LOOP
    v_data := build_weekly_recap(v_user.id, now() - interval '7 days');
    CONTINUE WHEN coalesce((v_data->>'liked')::int, 0) = 0
              AND coalesce((v_data->>'reactions')::int, 0) = 0
              AND coalesce((v_data->>'received')::int, 0) = 0
              AND coalesce((v_data->>'friend_songs')::int, 0) = 0;

    INSERT INTO weekly_recaps (user_id, week_start, data) VALUES (v_user.id, v_week, v_data)
    ON CONFLICT (user_id, week_start) DO NOTHING;
    CONTINUE WHEN NOT FOUND;
    v_made := v_made + 1;

    -- one-line summary for the notification
    v_body := concat_ws(' · ',
      CASE WHEN (v_data->>'liked')::int > 0 THEN
        'you liked ' || (v_data->>'liked') || CASE WHEN (v_data->>'liked')::int = 1 THEN ' song' ELSE ' songs' END END,
      CASE WHEN v_data ? 'top_artist' THEN 'top artist: ' || (v_data->>'top_artist') END,
      CASE WHEN (v_data->>'reactions')::int > 0 THEN
        (v_data->>'reactions') || CASE WHEN (v_data->>'reactions')::int = 1 THEN ' reaction' ELSE ' reactions' END END,
      CASE WHEN (v_data->>'saves')::int > 0 THEN
        (v_data->>'saves') || CASE WHEN (v_data->>'saves')::int = 1 THEN ' song saved from you' ELSE ' songs saved from you' END END,
      CASE WHEN (v_data->>'liked')::int = 0 AND v_data ? 'top_friend' THEN
        '@' || (v_data->'top_friend'->>'username') || ' added ' || (v_data->'top_friend'->>'count')
        || CASE WHEN (v_data->'top_friend'->>'count')::int = 1 THEN ' song' ELSE ' songs' END END
    );
    INSERT INTO notifications (user_id, type, actor_id, data)
    VALUES (v_user.id, 'weekly_recap', NULL, jsonb_build_object('summary', v_body));
  END LOOP;
  RETURN v_made;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_weekly_recaps() FROM PUBLIC, anon, authenticated;

-- Fridays 22:00 UTC (6pm New York, 3pm LA, 11pm London)
SELECT cron.unschedule('weekly-recap-friday') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-recap-friday');
SELECT cron.schedule('weekly-recap-friday', '0 22 * * 5', $cron$ SELECT public.generate_weekly_recaps(); $cron$);
DELETE FROM public.weekly_recaps WHERE created_at < now() - interval '1 year';
