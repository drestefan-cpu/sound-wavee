-- 1. friends_on_track: everything people you follow have done with a song (loved, saved, reacted,
--    sent it to you / you to them, made it their song of the week) — for the song screen.
-- 2. artist_songs_on_plai: songs by an artist that you or people you follow love — for artist pages.
-- 3. Monday reminder: "pick your song of the week", for people active lately without a current pick.

CREATE OR REPLACE FUNCTION public.friends_on_track(p_track_id uuid)
RETURNS TABLE (
  user_id uuid, username text, display_name text, avatar_url text,
  loved boolean, saved boolean, emoji text, sent_you boolean, you_sent boolean, pick boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  friends AS (SELECT f.following_id AS id FROM follows f, me WHERE f.follower_id = me.uid),
  activity AS (
  SELECT p.id, p.username, p.display_name, p.avatar_url,
    EXISTS (SELECT 1 FROM likes l WHERE l.user_id = p.id AND l.track_id = p_track_id AND NOT like_hidden_by_owner(l.user_id, l.track_id)) AS loved,
    EXISTS (SELECT 1 FROM saved_tracks s WHERE s.user_id = p.id AND s.track_id = p_track_id) AS saved,
    (SELECT r.emoji FROM reactions r JOIN likes l ON l.id = r.like_id
      WHERE r.user_id = p.id AND l.track_id = p_track_id ORDER BY r.created_at DESC LIMIT 1) AS emoji,
    EXISTS (SELECT 1 FROM recommendations rc, me WHERE rc.from_user_id = p.id AND rc.to_user_id = me.uid AND rc.track_id = p_track_id) AS sent_you,
    EXISTS (SELECT 1 FROM recommendations rc, me WHERE rc.from_user_id = me.uid AND rc.to_user_id = p.id AND rc.track_id = p_track_id) AS you_sent,
    coalesce(p.pick_track_id = p_track_id AND p.pick_set_at > now() - interval '7 days', false) AS pick
  FROM profiles p JOIN friends fr ON fr.id = p.id
  WHERE p.username IS NOT NULL
  )
  SELECT * FROM activity a
   WHERE a.loved OR a.saved OR a.emoji IS NOT NULL OR a.sent_you OR a.you_sent OR coalesce(a.pick, false)
   ORDER BY coalesce(a.pick, false) DESC, a.sent_you DESC, a.loved DESC, a.saved DESC
   LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.friends_on_track(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_on_track(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.artist_songs_on_plai(p_artist text)
RETURNS TABLE (
  track_id uuid, title text, artist text, album text, album_art_url text, short_id text,
  spotify_track_id text, spotify_link_id text, apple_music_id text, tidal_track_id text, amazon_music_id text,
  mine boolean, lovers jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  people AS (SELECT me.uid AS id FROM me UNION SELECT f.following_id FROM follows f, me WHERE f.follower_id = me.uid),
  loved AS (
    SELECT l.track_id, l.user_id FROM likes l JOIN people pp ON pp.id = l.user_id
     WHERE (l.user_id = (SELECT uid FROM me) OR NOT like_hidden_by_owner(l.user_id, l.track_id))
    UNION
    SELECT s.track_id, s.user_id FROM saved_tracks s JOIN people pp ON pp.id = s.user_id
  ),
  by_artist AS (
    SELECT t.* FROM tracks t
     WHERE t.id IN (SELECT track_id FROM loved)
       AND lower(trim(p_artist)) = ANY (SELECT lower(a) FROM unnest(split_artists(t.artist)) a)
  )
  SELECT t.id, t.title, t.artist, t.album, t.album_art_url, t.short_id,
         t.spotify_track_id, t.spotify_link_id, t.apple_music_id, t.tidal_track_id, t.amazon_music_id,
         EXISTS (SELECT 1 FROM loved lv, me WHERE lv.track_id = t.id AND lv.user_id = me.uid),
         coalesce((SELECT jsonb_agg(jsonb_build_object('username', p.username, 'avatar_url', p.avatar_url) ORDER BY p.username)
                     FROM loved lv JOIN profiles p ON p.id = lv.user_id, me
                    WHERE lv.track_id = t.id AND lv.user_id <> me.uid AND p.username IS NOT NULL), '[]'::jsonb)
    FROM by_artist t
   ORDER BY 13 DESC, t.title
   LIMIT 40;
$$;
REVOKE ALL ON FUNCTION public.artist_songs_on_plai(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artist_songs_on_plai(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_pick_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO notifications (user_id, type, data)
  SELECT p.id, 'pick_reminder', '{}'::jsonb
    FROM profiles p
   WHERE p.username IS NOT NULL
     AND p.last_seen_at > now() - interval '14 days'
     AND (p.pick_set_at IS NULL OR p.pick_set_at < now() - interval '6 days')
     AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = p.id AND n.type = 'pick_reminder'
                      AND n.created_at > now() - interval '6 days');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.send_pick_reminders() FROM PUBLIC, anon, authenticated;

-- Mondays 17:00 UTC (noon New York, 6pm London)
SELECT cron.unschedule('pick-reminder-monday') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pick-reminder-monday');
SELECT cron.schedule('pick-reminder-monday', '0 17 * * 1', $cron$ SELECT public.send_pick_reminders(); $cron$);
