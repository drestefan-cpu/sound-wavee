-- Notifications inbox: table + triggers that create notifications server-side.
-- Clients can only read and mark their own notifications as read; they cannot insert,
-- so notifications can't be faked from the browser.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- who receives it
  type text NOT NULL,                                                        -- follow | reaction | save | recommendation | new_music
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,           -- who caused it
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  data jsonb,                                                                -- display info (names, track title, emoji, count)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── Helper: insert one notification with actor + track display info ─────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_type text, p_actor_id uuid, p_track_id uuid, p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- plain variables (not records) so they're safely NULL when there's no track
  v_username text;
  v_display_name text;
  v_avatar text;
  v_title text;
  v_artist text;
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;  -- never notify people about their own actions
  END IF;
  SELECT username, display_name, avatar_url INTO v_username, v_display_name, v_avatar
    FROM profiles WHERE id = p_actor_id;
  IF p_track_id IS NOT NULL THEN
    SELECT title, artist INTO v_title, v_artist FROM tracks WHERE id = p_track_id;
  END IF;
  INSERT INTO notifications (user_id, type, actor_id, track_id, data)
  VALUES (
    p_user_id, p_type, p_actor_id, p_track_id,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_username', v_username,
      'actor_display_name', v_display_name,
      'actor_avatar', v_avatar,
      'track_title', v_title,
      'track_artist', v_artist
    )) || coalesce(p_extra, '{}'::jsonb)
  );
END;
$$;

-- Only triggers should call this, not clients
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── follow ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_notification(NEW.following_id, 'follow', NEW.follower_id, NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the follow/like/reaction itself
  RAISE WARNING 'notify_on_follow failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_follow ON public.follows;
CREATE TRIGGER notify_on_follow AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── reaction on someone's liked song ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_reaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_like record;
BEGIN
  SELECT user_id, track_id INTO v_like FROM likes WHERE id = NEW.like_id;
  IF FOUND THEN
    PERFORM create_notification(v_like.user_id, 'reaction', NEW.user_id, v_like.track_id,
                                jsonb_build_object('emoji', NEW.emoji));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the follow/like/reaction itself
  RAISE WARNING 'notify_on_reaction failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_reaction ON public.reactions;
CREATE TRIGGER notify_on_reaction AFTER INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ── someone saved a song they found via you ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_save() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_notification(NEW.source_user_id, 'save', NEW.user_id, NEW.track_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the follow/like/reaction itself
  RAISE WARNING 'notify_on_save failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_save ON public.saved_tracks;
CREATE TRIGGER notify_on_save AFTER INSERT ON public.saved_tracks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_save();

-- ── recommendation sent to you ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_recommendation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_notification(NEW.to_user_id, 'recommendation', NEW.from_user_id, NEW.track_id,
                              jsonb_strip_nulls(jsonb_build_object('message', NEW.message)));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the follow/like/reaction itself
  RAISE WARNING 'notify_on_recommendation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_recommendation ON public.recommendations;
CREATE TRIGGER notify_on_recommendation AFTER INSERT ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_recommendation();

-- ── grouped "added new music" alerts for people who turned on the bell ───────
-- Fires only for genuinely new likes (AFTER INSERT doesn't fire for upsert updates),
-- and only for songs liked in the last 7 days, so a first-ever sync of someone's
-- whole library doesn't produce "added 300 songs".
-- Likes from the same person are folded into one unread alert for 6 hours.
CREATE OR REPLACE FUNCTION public.notify_on_new_music() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub record;
  v_track record;
BEGIN
  IF NEW.user_id IS NULL OR coalesce(NEW.liked_at, now()) < now() - interval '7 days' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_notify_follows WHERE target_user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT title, artist INTO v_track FROM tracks WHERE id = NEW.track_id;

  FOR v_sub IN SELECT follower_id FROM user_notify_follows WHERE target_user_id = NEW.user_id LOOP
    CONTINUE WHEN v_sub.follower_id = NEW.user_id;

    UPDATE notifications
       SET data = data
                  || jsonb_build_object('count', coalesce((data->>'count')::int, 1) + 1)
                  || jsonb_strip_nulls(jsonb_build_object('track_title', v_track.title, 'track_artist', v_track.artist)),
           track_id = NEW.track_id,
           created_at = now()
     WHERE user_id = v_sub.follower_id
       AND actor_id = NEW.user_id
       AND type = 'new_music'
       AND read = false
       AND created_at > now() - interval '6 hours';

    IF NOT FOUND THEN
      PERFORM create_notification(v_sub.follower_id, 'new_music', NEW.user_id, NEW.track_id,
                                  jsonb_build_object('count', 1));
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure block the follow/like/reaction itself
  RAISE WARNING 'notify_on_new_music failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_new_music ON public.likes;
CREATE TRIGGER notify_on_new_music AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_music();

-- Trigger functions are only meant to run as triggers
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_reaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_save() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_recommendation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_new_music() FROM PUBLIC, anon, authenticated;
