-- Spotify access requests. While PLAI's Spotify app is in development mode, Spotify only lets
-- people on the allowlist connect. When someone else tries, PLAI asks for their Spotify email and
-- saves a request here; admins are notified (and pushed), add them in Spotify's dashboard, then
-- mark them added, which tells the person (if they've made a PLAI account meanwhile).

CREATE TABLE IF NOT EXISTS public.spotify_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added')),
  created_at timestamptz NOT NULL DEFAULT now(),
  added_at timestamptz
);
ALTER TABLE public.spotify_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spotify_access_requests FROM anon, authenticated;
-- (no policies: only the functions below touch it)

-- Anyone (signed in or not) can ask. Re-asking with the same email just refreshes it.
CREATE OR REPLACE FUNCTION public.request_spotify_access(p_email text, p_name text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_new boolean;
  v_admin record;
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN
    RAISE EXCEPTION 'that doesn''t look like an email address' USING ERRCODE = 'P0001';
  END IF;
  -- spam limit: 30 new requests a day across PLAI
  IF (SELECT count(*) FROM spotify_access_requests WHERE created_at > now() - interval '1 day') >= 30
     AND NOT EXISTS (SELECT 1 FROM spotify_access_requests WHERE email = v_email) THEN
    RAISE EXCEPTION 'lots of requests right now — email andre@delaneyprojects.xyz instead' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO spotify_access_requests (email, name, user_id)
  VALUES (v_email, nullif(left(trim(coalesce(p_name, '')), 60), ''), auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET name = coalesce(EXCLUDED.name, spotify_access_requests.name),
        user_id = coalesce(auth.uid(), spotify_access_requests.user_id)
  RETURNING (xmax = 0) INTO v_new;

  IF v_new THEN
    FOR v_admin IN SELECT user_id FROM app_admins LOOP
      INSERT INTO notifications (user_id, type, data)
      VALUES (v_admin.user_id, 'spotify_request', jsonb_strip_nulls(jsonb_build_object('email', v_email, 'name', nullif(trim(coalesce(p_name, '')), ''))));
    END LOOP;
  END IF;
  RETURN (SELECT status FROM spotify_access_requests WHERE email = v_email);
END;
$$;
REVOKE ALL ON FUNCTION public.request_spotify_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_spotify_access(text, text) TO anon, authenticated;

-- After making a PLAI account another way: link the request so they hear when they're approved
CREATE OR REPLACE FUNCTION public.link_spotify_request(p_email text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE spotify_access_requests SET user_id = auth.uid()
   WHERE email = lower(trim(p_email)) AND user_id IS NULL AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.link_spotify_request(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_spotify_request(text) TO authenticated;

-- Admin: the list, and "mark added"
CREATE OR REPLACE FUNCTION public.admin_spotify_requests()
RETURNS TABLE (id uuid, email text, name text, username text, status text, created_at timestamptz, added_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
    SELECT r.id, r.email, r.name, p.username, r.status, r.created_at, r.added_at
      FROM spotify_access_requests r LEFT JOIN profiles p ON p.id = r.user_id
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_spotify_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_spotify_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_spotify_added(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admins only'; END IF;
  UPDATE spotify_access_requests SET status = 'added', added_at = now()
   WHERE id = p_id AND status = 'pending' RETURNING user_id INTO v_user;
  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, data) VALUES (v_user, 'spotify_approved', '{}'::jsonb);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_spotify_added(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_spotify_added(uuid) TO authenticated;
