-- PLAI database checks: privacy rules and key flows, tested as real accounts.
-- Everything runs inside one transaction that is ROLLED BACK at the end, so nothing is changed.
-- Run with:  npm run test:db   (needs `supabase login` + `supabase link`)
--
-- Uses three existing accounts: dre.stefan (admin), jantidal (a friend) and andreappletest
-- (stands in for a brand-new account).

BEGIN;

CREATE TEMP TABLE results (check_name text, ok boolean, detail text) ON COMMIT DROP;
CREATE TEMP TABLE ids ON COMMIT DROP AS SELECT
  (SELECT id FROM profiles WHERE username = 'dre.stefan') AS dre,
  (SELECT id FROM profiles WHERE username = 'jantidal') AS jan,
  (SELECT id FROM profiles WHERE username = 'andreappletest') AS newbie,
  (SELECT l.track_id FROM likes l WHERE l.user_id = (SELECT id FROM profiles WHERE username = 'dre.stefan')
    ORDER BY l.created_at DESC LIMIT 1) AS dre_track;
GRANT ALL ON results, ids TO authenticated, anon;

INSERT INTO results SELECT 'test accounts exist', dre IS NOT NULL AND jan IS NOT NULL AND newbie IS NOT NULL AND dre_track IS NOT NULL,
  'needs dre.stefan, jantidal, andreappletest' FROM ids;

-- ── setup (as the database owner) ──────────────────────────────────────────
-- newbie: a brand-new account with no follows; dre and jan follow each other
DELETE FROM follows WHERE follower_id = (SELECT newbie FROM ids) OR following_id = (SELECT newbie FROM ids);
UPDATE profiles SET created_at = now(), invited_by = NULL WHERE id = (SELECT newbie FROM ids);
INSERT INTO follows (follower_id, following_id) SELECT dre, jan FROM ids ON CONFLICT DO NOTHING;
INSERT INTO follows (follower_id, following_id) SELECT jan, dre FROM ids ON CONFLICT DO NOTHING;
-- dre hides one of their songs; dre has a phone with notifications on; a recap exists for dre
INSERT INTO hidden_tracks (user_id, track_id) SELECT dre, dre_track FROM ids;
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) SELECT dre, 'https://push.test/dre', 'k', 'a' FROM ids;
INSERT INTO weekly_recaps (user_id, week_start, data) SELECT dre, current_date - 6, '{"liked":1}' FROM ids;
DELETE FROM recommendations WHERE from_user_id = (SELECT dre FROM ids) AND to_user_id = (SELECT jan FROM ids)
  AND track_id = (SELECT dre_track FROM ids);

-- ── as dre.stefan ──────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT dre FROM ids), 'role', 'authenticated')::text, true);

DO $$
DECLARE v_rec uuid; n int;
BEGIN
  -- sending a song to a friend notifies them, with the message
  INSERT INTO recommendations (from_user_id, to_user_id, track_id, message)
    SELECT dre, jan, dre_track, 'db check' FROM ids RETURNING id INTO v_rec;
  -- a reply in that thread
  INSERT INTO recommendation_replies (recommendation_id, user_id, body) SELECT v_rec, dre, 'reply check' FROM ids;

  -- songs can only be sent to friends
  BEGIN
    INSERT INTO recommendations (from_user_id, to_user_id, track_id) SELECT dre, newbie, dre_track FROM ids;
    INSERT INTO results VALUES ('songs can only be sent to friends', false, 'sending to a stranger worked');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN
    INSERT INTO results VALUES ('songs can only be sent to friends', true, '');
  END;

  -- admins see the People overview
  SELECT count(*) INTO n FROM admin_activity();
  INSERT INTO results VALUES ('admin can open the People overview', n > 0, n || ' people');

  -- you can see your own hidden song
  INSERT INTO results SELECT 'you still see songs you hid', EXISTS (SELECT 1 FROM ids, likes l WHERE l.user_id = ids.dre AND l.track_id = ids.dre_track), '';
END $$;
RESET ROLE;

-- ── as jantidal (a friend, not an admin) ───────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT jan FROM ids), 'role', 'authenticated')::text, true);

DO $$
DECLARE n int;
BEGIN
  -- (notifications are private, so they're checked as the person who receives them)
  INSERT INTO results SELECT 'sending a song notifies the friend',
    EXISTS (SELECT 1 FROM notifications n WHERE n.type = 'recommendation' AND n.data->>'message' = 'db check'), '';
  INSERT INTO results SELECT 'a reply notifies the other person',
    EXISTS (SELECT 1 FROM notifications n WHERE n.type = 'rec_reply' AND n.data->>'message' = 'reply check'), '';
  SELECT count(*) INTO n FROM notifications WHERE user_id <> auth.uid();
  INSERT INTO results VALUES ('other people''s notifications are private', n = 0, n || ' visible');

  INSERT INTO results SELECT 'friends can''t see songs you hid',
    NOT EXISTS (SELECT 1 FROM ids, likes l WHERE l.user_id = ids.dre AND l.track_id = ids.dre_track), '';

  SELECT count(*) INTO n FROM push_subscriptions;
  INSERT INTO results VALUES ('other people''s devices are private', n = 0, n || ' visible');

  SELECT count(*) INTO n FROM weekly_recaps WHERE user_id <> auth.uid();
  INSERT INTO results VALUES ('other people''s recaps are private', n = 0, n || ' visible');

  SELECT count(*) INTO n FROM recommendation_replies;
  INSERT INTO results VALUES ('the receiver sees the reply', n >= 1, n || ' visible');

  BEGIN
    PERFORM spotify_refresh_token FROM profiles LIMIT 1;
    INSERT INTO results VALUES ('music-app keys are private', false, 'readable');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('music-app keys are private', true, '');
  END;

  BEGIN
    PERFORM 1 FROM pin_login_attempts LIMIT 1;
    INSERT INTO results VALUES ('PIN attempt log is private', false, 'readable');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('PIN attempt log is private', true, '');
  END;

  BEGIN
    PERFORM 1 FROM sync_log LIMIT 1;
    INSERT INTO results VALUES ('sync log is private', false, 'readable');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('sync log is private', true, '');
  END;

  BEGIN
    PERFORM 1 FROM admin_activity();
    INSERT INTO results VALUES ('non-admins can''t open the People overview', false, 'opened');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('non-admins can''t open the People overview', SQLERRM LIKE '%admins only%', SQLERRM);
  END;

  BEGIN
    INSERT INTO notifications (user_id, type) SELECT dre, 'follow' FROM ids;
    INSERT INTO results VALUES ('notifications can''t be faked', false, 'inserted');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    INSERT INTO results VALUES ('notifications can''t be faked', true, '');
  END;
END $$;
RESET ROLE;

-- ── as andreappletest (a brand-new account that opened dre's invite) ───────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT newbie FROM ids), 'role', 'authenticated')::text, true);

DO $$
DECLARE r1 text; r2 text; n int;
BEGIN
  SELECT count(*) INTO n FROM recommendation_replies;
  INSERT INTO results VALUES ('replies are private to the two people', n = 0, n || ' visible');

  r1 := accept_invite('dre.stefan');
  r2 := accept_invite('dre.stefan');
  SELECT count(*) INTO n FROM ids, follows f
   WHERE (f.follower_id = ids.newbie AND f.following_id = ids.dre) OR (f.follower_id = ids.dre AND f.following_id = ids.newbie);
  INSERT INTO results VALUES ('invite: new account and inviter follow each other', r1 = 'joined' AND n = 2, r1 || ', ' || n || ' follows');
  INSERT INTO results VALUES ('invite: only counts once', r2 = 'followed', r2);
END $$;
RESET ROLE;

-- ── Spotify access requests (as someone not signed in) ─────────────────────
SET LOCAL ROLE anon;
DO $$
BEGIN
  INSERT INTO results SELECT 'anyone can ask for Spotify access', request_spotify_access('db-check@example.com', 'DB check') = 'pending', '';
  BEGIN
    PERFORM 1 FROM spotify_access_requests;
    INSERT INTO results VALUES ('Spotify request emails are private', false, 'readable');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('Spotify request emails are private', true, '');
  END;
END $$;
RESET ROLE;
INSERT INTO results SELECT 'admins are told about Spotify requests',
  EXISTS (SELECT 1 FROM ids, notifications n WHERE n.user_id = ids.dre AND n.type = 'spotify_request' AND n.data->>'email' = 'db-check@example.com'), '';

-- ── account deletion removes everything (as the database owner) ────────────
DELETE FROM auth.users WHERE id = (SELECT newbie FROM ids);
INSERT INTO results SELECT 'deleting an account removes it and its follows',
  NOT EXISTS (SELECT 1 FROM ids, profiles p WHERE p.id = ids.newbie)
  AND NOT EXISTS (SELECT 1 FROM ids, follows f WHERE f.follower_id = ids.newbie OR f.following_id = ids.newbie), '';

SELECT check_name, ok, detail FROM results;
ROLLBACK;
