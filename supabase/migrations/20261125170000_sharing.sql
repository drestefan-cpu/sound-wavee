-- Recommending & sharing overhaul
--  1. Recommendations: only to friends (either follows the other), never the same song twice to the
--     same person, at most 40 an hour; recipients can react with an emoji (and only change
--     seen / reaction); the sender is notified of reactions.
--  2. Saves from a recommendation are credited to the sender ("saved the song you sent").
--  3. Send screen helper: your friends, ordered by how often you send to them.
--  4. Sent list: what you recommended, and whether they saved / reacted.
--  5. Share link stats: which sharer's link each song-page open came from.

-- ── 1. Recommendations ───────────────────────────────────────────────────────
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS reaction text CHECK (reaction IS NULL OR char_length(reaction) <= 8),
  ADD COLUMN IF NOT EXISTS reacted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_once_per_song
  ON public.recommendations (from_user_id, to_user_id, track_id);

DROP POLICY IF EXISTS "Users can insert recommendations" ON public.recommendations;
CREATE POLICY "Users can insert recommendations" ON public.recommendations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = from_user_id
    AND to_user_id <> from_user_id
    AND EXISTS (
      SELECT 1 FROM public.follows f
       WHERE (f.follower_id = from_user_id AND f.following_id = to_user_id)
          OR (f.follower_id = to_user_id AND f.following_id = from_user_id)
    )
  );

-- Recipients may only mark as seen and react — not rewrite the message, song or sender
REVOKE UPDATE ON public.recommendations FROM authenticated, anon;
GRANT UPDATE (seen, reaction, reacted_at) ON public.recommendations TO authenticated;

CREATE OR REPLACE FUNCTION public.limit_recommendations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM recommendations
       WHERE from_user_id = NEW.from_user_id AND created_at > now() - interval '1 hour') >= 40 THEN
    RAISE EXCEPTION 'too many recommendations — try again in a bit' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.limit_recommendations() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS limit_recommendations ON public.recommendations;
CREATE TRIGGER limit_recommendations BEFORE INSERT ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.limit_recommendations();

CREATE OR REPLACE FUNCTION public.notify_on_recommendation_reaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reaction IS NOT NULL AND NEW.reaction IS DISTINCT FROM OLD.reaction THEN
    PERFORM create_notification(NEW.from_user_id, 'rec_reaction', NEW.to_user_id, NEW.track_id,
                                jsonb_build_object('emoji', NEW.reaction));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_recommendation_reaction failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_on_recommendation_reaction() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_on_recommendation_reaction ON public.recommendations;
CREATE TRIGGER notify_on_recommendation_reaction AFTER UPDATE OF reaction ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_recommendation_reaction();

-- ── 2. Save notifications say where the song came from ───────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_save() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_notification(NEW.source_user_id, 'save', NEW.user_id, NEW.track_id,
                              jsonb_strip_nulls(jsonb_build_object('context', NEW.source_context)));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_save failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 3. Send screen: friends ordered by how often you send to them ────────────
CREATE OR REPLACE FUNCTION public.recommend_candidates(p_track_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text,
  relation text, sent_count int, last_sent_at timestamptz, already_sent boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  rel AS (
    SELECT f.following_id AS uid, 'following' AS r FROM follows f, me WHERE f.follower_id = me.uid
    UNION ALL
    SELECT f.follower_id, 'follower' FROM follows f, me WHERE f.following_id = me.uid
  ),
  friends AS (
    SELECT uid, CASE WHEN count(DISTINCT r) > 1 THEN 'mutual' ELSE min(r) END AS relation
      FROM rel GROUP BY uid
  ),
  sent AS (
    SELECT r.to_user_id AS uid, count(*)::int AS n, max(r.created_at) AS last_at,
           bool_or(p_track_id IS NOT NULL AND r.track_id = p_track_id) AS already
      FROM recommendations r, me WHERE r.from_user_id = me.uid GROUP BY r.to_user_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url, fr.relation,
         coalesce(s.n, 0), s.last_at, coalesce(s.already, false)
    FROM friends fr
    JOIN profiles p ON p.id = fr.uid
    LEFT JOIN sent s ON s.uid = fr.uid
   WHERE p.username IS NOT NULL
   ORDER BY coalesce(s.n, 0) DESC, s.last_at DESC NULLS LAST,
            (fr.relation = 'mutual') DESC, lower(p.username);
$$;
REVOKE ALL ON FUNCTION public.recommend_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recommend_candidates(uuid) TO authenticated;

-- ── 4. Sent list ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_sent_recommendations(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, created_at timestamptz, message text, reaction text, seen boolean, saved boolean,
  to_id uuid, to_username text, to_display_name text, to_avatar_url text,
  track_id uuid, title text, artist text, album text, album_art_url text, spotify_track_id text,
  spotify_link_id text, apple_music_id text, tidal_track_id text, amazon_music_id text, short_id text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.created_at, r.message, r.reaction, r.seen,
         EXISTS (SELECT 1 FROM saved_tracks s WHERE s.user_id = r.to_user_id AND s.track_id = r.track_id),
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

-- ── 5. Share link stats ──────────────────────────────────────────────────────
ALTER TABLE public.share_opens ADD COLUMN IF NOT EXISTS sharer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS share_opens_sharer_idx ON public.share_opens (sharer_id, opened_at DESC);

CREATE OR REPLACE FUNCTION public.my_share_stats()
RETURNS TABLE (
  total_opens int, opens_7d int,
  track_id uuid, title text, artist text, album_art_url text, opens int, last_opened_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (SELECT * FROM share_opens WHERE sharer_id = auth.uid()),
  totals AS (
    SELECT count(*)::int AS total, count(*) FILTER (WHERE opened_at > now() - interval '7 days')::int AS week FROM mine
  ),
  per_track AS (
    SELECT track_id, count(*)::int AS n, max(opened_at) AS last_at FROM mine GROUP BY track_id
    ORDER BY max(opened_at) DESC LIMIT 10
  )
  SELECT totals.total, totals.week, t.id, t.title, t.artist, t.album_art_url, pt.n, pt.last_at
    FROM totals
    LEFT JOIN per_track pt ON true
    LEFT JOIN tracks t ON t.id = pt.track_id
   ORDER BY pt.last_at DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.my_share_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_share_stats() TO authenticated;
