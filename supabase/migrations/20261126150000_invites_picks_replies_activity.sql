-- Four retention features:
--  1. Invite links (/join/<username>): a new account that came from an invite follows the inviter
--     and is followed back, and the inviter is told.
--  2. Song of the week: one pinned song per person, shown on their profile, in friends' feeds and
--     in the Friday recap, for 7 days.
--  3. Replies on songs sent to you: a short back-and-forth between the two people.
--  4. Activity: when each person last opened PLAI, plus an admin-only overview.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pick_track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pick_note text,
  ADD COLUMN IF NOT EXISTS pick_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
-- picks are public like the rest of a profile; invited_by / last_seen_at stay private
GRANT SELECT (pick_track_id, pick_note, pick_set_at) ON public.profiles TO anon, authenticated;

-- ── 1. invites ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invite(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_created timestamptz;
  v_already uuid;
BEGIN
  IF v_me IS NULL THEN RETURN 'signed_out'; END IF;
  SELECT id INTO v_inviter FROM profiles WHERE username = lower(trim(p_username));
  IF v_inviter IS NULL THEN RETURN 'not_found'; END IF;
  IF v_inviter = v_me THEN RETURN 'self'; END IF;

  -- you follow them (always fine)
  INSERT INTO follows (follower_id, following_id) VALUES (v_me, v_inviter) ON CONFLICT DO NOTHING;

  -- they follow you back only for brand-new accounts, once — so the link can't be used
  -- by existing accounts to make someone follow them
  SELECT created_at, invited_by INTO v_created, v_already FROM profiles WHERE id = v_me;
  IF v_already IS NULL AND v_created > now() - interval '1 day' THEN
    UPDATE profiles SET invited_by = v_inviter WHERE id = v_me;
    INSERT INTO follows (follower_id, following_id) VALUES (v_inviter, v_me) ON CONFLICT DO NOTHING;
    PERFORM create_notification(v_inviter, 'invite_joined', v_me, NULL);
    RETURN 'joined';
  END IF;
  RETURN 'followed';
END;
$$;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- (the "X followed you" notification from the automatic follow-back would be noise next to
--  "joined from your invite", so it's skipped for that one follow)
CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.following_id AND invited_by = NEW.follower_id
              AND created_at > now() - interval '1 day') THEN
    RETURN NEW;
  END IF;
  PERFORM create_notification(NEW.following_id, 'follow', NEW.follower_id, NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_follow failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;

-- ── 2. song of the week ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_song_of_week(p_track_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles
     SET pick_track_id = p_track_id,
         pick_note = CASE WHEN p_track_id IS NULL THEN NULL ELSE nullif(left(trim(coalesce(p_note, '')), 80), '') END,
         pick_set_at = CASE WHEN p_track_id IS NULL THEN NULL ELSE now() END
   WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.set_song_of_week(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_song_of_week(uuid, text) TO authenticated;

-- Current picks (last 7 days) of the people you follow, newest first
CREATE OR REPLACE FUNCTION public.friends_picks()
RETURNS TABLE (
  user_id uuid, username text, display_name text, avatar_url text, note text, set_at timestamptz,
  track_id uuid, title text, artist text, album_art_url text, short_id text,
  spotify_track_id text, spotify_link_id text, apple_music_id text, tidal_track_id text, amazon_music_id text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.pick_note, p.pick_set_at,
         t.id, t.title, t.artist, t.album_art_url, t.short_id,
         t.spotify_track_id, t.spotify_link_id, t.apple_music_id, t.tidal_track_id, t.amazon_music_id
    FROM follows f
    JOIN profiles p ON p.id = f.following_id
    JOIN tracks t ON t.id = p.pick_track_id
   WHERE f.follower_id = auth.uid() AND p.pick_set_at > now() - interval '7 days' AND p.username IS NOT NULL
   ORDER BY p.pick_set_at DESC
   LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.friends_picks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_picks() TO authenticated;

-- ── 3. replies on songs sent to you ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recommendation_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recommendation_replies_rec_idx ON public.recommendation_replies (recommendation_id, created_at);
ALTER TABLE public.recommendation_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_replies FROM anon;
REVOKE UPDATE ON public.recommendation_replies FROM authenticated;

-- only the sender and the receiver of that song
CREATE OR REPLACE FUNCTION public.is_rec_participant(p_rec uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM recommendations r WHERE r.id = p_rec AND auth.uid() IN (r.from_user_id, r.to_user_id));
$$;
REVOKE ALL ON FUNCTION public.is_rec_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_rec_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "replies: read own threads" ON public.recommendation_replies;
CREATE POLICY "replies: read own threads" ON public.recommendation_replies FOR SELECT TO authenticated
  USING (is_rec_participant(recommendation_id));
DROP POLICY IF EXISTS "replies: write own" ON public.recommendation_replies;
CREATE POLICY "replies: write own" ON public.recommendation_replies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_rec_participant(recommendation_id));
DROP POLICY IF EXISTS "replies: delete own" ON public.recommendation_replies;
CREATE POLICY "replies: delete own" ON public.recommendation_replies FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- spam limit: 30 replies an hour
CREATE OR REPLACE FUNCTION public.limit_rec_replies() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM recommendation_replies WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'slow down — try again in a bit' USING ERRCODE = 'P0001';
  END IF;
  NEW.body := trim(NEW.body);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS limit_rec_replies ON public.recommendation_replies;
CREATE TRIGGER limit_rec_replies BEFORE INSERT ON public.recommendation_replies
  FOR EACH ROW EXECUTE FUNCTION public.limit_rec_replies();

-- tell the other person (also pushes to their phone)
CREATE OR REPLACE FUNCTION public.notify_on_rec_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  SELECT from_user_id, to_user_id, track_id INTO r FROM recommendations WHERE id = NEW.recommendation_id;
  PERFORM create_notification(
    CASE WHEN NEW.user_id = r.from_user_id THEN r.to_user_id ELSE r.from_user_id END,
    'rec_reply', NEW.user_id, r.track_id,
    jsonb_build_object('message', left(NEW.body, 140), 'sent_by_me', NEW.user_id = r.to_user_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_rec_reply failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_rec_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limit_rec_replies() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_on_rec_reply ON public.recommendation_replies;
CREATE TRIGGER notify_on_rec_reply AFTER INSERT ON public.recommendation_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_rec_reply();

-- ── 4. activity ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles SET last_seen_at = now()
   WHERE id = auth.uid() AND (last_seen_at IS NULL OR last_seen_at < now() - interval '10 minutes');
$$;
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- Admin overview: everyone with a username, how active they are, and whether their syncs work
CREATE OR REPLACE FUNCTION public.admin_activity()
RETURNS TABLE (
  username text, display_name text, avatar_url text, joined timestamptz, last_seen_at timestamptz,
  apps text[], broken_apps text[], last_synced_at timestamptz,
  likes_7d int, sent_7d int, reactions_7d int, following int, followers int,
  push_devices int, invited_by text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
  SELECT p.username, p.display_name, p.avatar_url, p.created_at, p.last_seen_at,
         array_remove(ARRAY[
           CASE WHEN p.spotify_refresh_token IS NOT NULL THEN 'spotify' END,
           CASE WHEN p.apple_music_user_token IS NOT NULL THEN 'apple-music' END,
           CASE WHEN p.tidal_refresh_token IS NOT NULL THEN 'tidal' END,
           CASE WHEN p.youtube_refresh_token IS NOT NULL THEN 'youtube' END
         ], NULL),
         ARRAY(
           SELECT l.platform FROM (
             SELECT DISTINCT ON (s.platform) s.platform, s.status, s.detail
               FROM sync_log s WHERE s.user_id = p.id AND s.created_at > now() - interval '7 days'
              ORDER BY s.platform, s.created_at DESC
           ) l WHERE sync_needs_reconnect(l.status, l.detail)
         ),
         p.last_synced_at,
         (SELECT count(*)::int FROM likes WHERE user_id = p.id AND coalesce(liked_at, created_at) > now() - interval '7 days'),
         (SELECT count(*)::int FROM recommendations WHERE from_user_id = p.id AND created_at > now() - interval '7 days'),
         (SELECT count(*)::int FROM reactions WHERE user_id = p.id AND created_at > now() - interval '7 days'),
         (SELECT count(*)::int FROM follows WHERE follower_id = p.id),
         (SELECT count(*)::int FROM follows WHERE following_id = p.id),
         (SELECT count(*)::int FROM push_subscriptions WHERE user_id = p.id),
         (SELECT i.username FROM profiles i WHERE i.id = p.invited_by)
    FROM profiles p
   WHERE p.username IS NOT NULL
   ORDER BY p.last_seen_at DESC NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity() TO authenticated;

-- ── Friday recap: add friends' songs of the week ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'build_weekly_recap_base') THEN
    ALTER FUNCTION public.build_weekly_recap(uuid, timestamptz) RENAME TO build_weekly_recap_base;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.build_weekly_recap_base(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.build_weekly_recap(p_user uuid, p_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_picks jsonb;
BEGIN
  SELECT jsonb_agg(x) INTO v_picks FROM (
    SELECT jsonb_build_object('username', p.username, 'name', coalesce(p.display_name, p.username),
                              'title', t.title, 'artist', t.artist) x
      FROM follows f JOIN profiles p ON p.id = f.following_id JOIN tracks t ON t.id = p.pick_track_id
     WHERE f.follower_id = p_user AND p.pick_set_at > now() - interval '7 days' AND p.username IS NOT NULL
     ORDER BY p.pick_set_at DESC LIMIT 3
  ) s;
  RETURN build_weekly_recap_base(p_user, p_since) || jsonb_strip_nulls(jsonb_build_object('picks', v_picks));
END;
$$;
REVOKE ALL ON FUNCTION public.build_weekly_recap(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
