-- "Shared with you via text": when a signed-in person opens a PLAI link a friend shared
-- (…/s/abc123?from=friend), the song lands in their "for you" as a recommendation from that friend.

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'link'));

-- The opener already has the song open, so no "recommended you a song" notification for link shares
CREATE OR REPLACE FUNCTION public.notify_on_recommendation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'link' THEN
    RETURN NEW;
  END IF;
  PERFORM create_notification(NEW.to_user_id, 'recommendation', NEW.from_user_id, NEW.track_id,
                              jsonb_strip_nulls(jsonb_build_object('message', NEW.message)));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_recommendation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Called by the song page. Only adds songs from friends (either follows the other), never your own
-- link, never twice. Returns true when the song was added.
CREATE OR REPLACE FUNCTION public.claim_shared_link(p_track_id uuid, p_from_username text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_sharer uuid;
  v_added int;
BEGIN
  IF v_me IS NULL OR p_track_id IS NULL OR p_from_username IS NULL THEN
    RETURN false;
  END IF;
  SELECT id INTO v_sharer FROM profiles WHERE lower(username) = lower(p_from_username) LIMIT 1;
  IF v_sharer IS NULL OR v_sharer = v_me THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM follows f
     WHERE (f.follower_id = v_me AND f.following_id = v_sharer)
        OR (f.follower_id = v_sharer AND f.following_id = v_me)
  ) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tracks WHERE id = p_track_id) THEN
    RETURN false;
  END IF;

  INSERT INTO recommendations (from_user_id, to_user_id, track_id, source, seen)
  VALUES (v_sharer, v_me, p_track_id, 'link', true)
  ON CONFLICT (from_user_id, to_user_id, track_id) DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN v_added > 0;
EXCEPTION WHEN OTHERS THEN
  RETURN false; -- e.g. the sharer hit the hourly limit; never break the song page
END;
$$;
REVOKE ALL ON FUNCTION public.claim_shared_link(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_shared_link(uuid, text) TO authenticated;

-- Sent list shows how each song was shared
DROP FUNCTION IF EXISTS public.my_sent_recommendations(int);
CREATE FUNCTION public.my_sent_recommendations(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, created_at timestamptz, message text, reaction text, seen boolean, saved boolean, source text,
  to_id uuid, to_username text, to_display_name text, to_avatar_url text,
  track_id uuid, title text, artist text, album text, album_art_url text, spotify_track_id text,
  spotify_link_id text, apple_music_id text, tidal_track_id text, amazon_music_id text, short_id text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.created_at, r.message, r.reaction, r.seen,
         EXISTS (SELECT 1 FROM saved_tracks s WHERE s.user_id = r.to_user_id AND s.track_id = r.track_id),
         r.source,
         p.id, p.username, p.display_name, p.avatar_url,
         t.id, t.title, t.artist, t.album, t.album_art_url, t.spotify_track_id,
         t.spotify_link_id, t.apple_music_id, t.tidal_track_id, t.amazon_music_id, t.short_id
    FROM recommendations r
    JOIN profiles p ON p.id = r.to_user_id
    JOIN tracks t ON t.id = r.track_id
   WHERE r.from_user_id = auth.uid()
   ORDER BY r.created_at DESC
   LIMIT greatest(1, least(p_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.my_sent_recommendations(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sent_recommendations(int) TO authenticated;
