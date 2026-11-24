-- Live schema snapshot of the PRODUCTION public schema (project sylwprldxdgbsncwyhfk)
-- Generated 2026-11-24 from the Postgres catalog via `supabase db query --linked`.
-- Reference only — this is what production actually looks like, which differs from
-- supabase/migrations/ (some changes were made in the dashboard, some tables were dropped).
-- Do NOT run this file as a migration.


-- ======================================================================
-- TABLES (columns, constraints, RLS)
-- ======================================================================

CREATE TABLE public.artist_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  artist_name text NOT NULL,
  title text NOT NULL,
  album text,
  album_art_url text,
  spotify_track_id text,
  release_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT artist_releases_pkey PRIMARY KEY (id),
  CONSTRAINT artist_releases_spotify_track_id_key UNIQUE (spotify_track_id)
);
ALTER TABLE public.artist_releases ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.collection_exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collection_exclusions_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT collection_exclusions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT collection_exclusions_pkey PRIMARY KEY (id),
  CONSTRAINT collection_exclusions_user_id_track_id_key UNIQUE (user_id, track_id)
);
ALTER TABLE public.collection_exclusions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.developer_notes (
  id integer NOT NULL DEFAULT 1,
  content text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT developer_notes_id_check CHECK ((id = 1)),
  CONSTRAINT developer_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT developer_notes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.developer_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.discover_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  cover_image_url text,
  body_markdown text,
  post_type text NOT NULL,
  external_url text,
  author_name text,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discover_posts_external_url_check CHECK ((((post_type = 'external'::text) AND (external_url IS NOT NULL)) OR (post_type = 'internal'::text))),
  CONSTRAINT discover_posts_internal_body_check CHECK ((((post_type = 'internal'::text) AND (body_markdown IS NOT NULL)) OR (post_type = 'external'::text))),
  CONSTRAINT discover_posts_post_type_check CHECK ((post_type = ANY (ARRAY['internal'::text, 'external'::text]))),
  CONSTRAINT discover_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
  CONSTRAINT discover_posts_pkey PRIMARY KEY (id),
  CONSTRAINT discover_posts_slug_key UNIQUE (slug)
);
ALTER TABLE public.discover_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid,
  following_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_id_following_id_key UNIQUE (follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hidden_tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  track_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hidden_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT hidden_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT hidden_tracks_pkey PRIMARY KEY (id),
  CONSTRAINT hidden_tracks_user_id_track_id_key UNIQUE (user_id, track_id)
);
-- RLS DISABLED on hidden_tracks

CREATE TABLE public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  track_id uuid,
  liked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT likes_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT likes_pkey PRIMARY KEY (id),
  CONSTRAINT likes_user_id_track_id_key UNIQUE (user_id, track_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profile_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  viewer_id uuid,
  profile_id uuid,
  tab_viewed text,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id),
  CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES profiles(id),
  CONSTRAINT profile_views_pkey PRIMARY KEY (id)
);
-- RLS DISABLED on profile_views

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text,
  display_name text,
  avatar_url text,
  spotify_id text,
  onboarding_complete boolean DEFAULT false,
  public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  spotify_access_token text,
  spotify_refresh_token text,
  last_synced_at timestamp with time zone,
  login_pin text,
  status text,
  profile_color text DEFAULT '#080B12'::text,
  tidal_access_token text,
  tidal_refresh_token text,
  tidal_user_id text,
  platform text DEFAULT 'spotify'::text,
  apple_music_token text,
  apple_music_user_token text,
  apple_music_user_id text,
  youtube_access_token text,
  youtube_refresh_token text,
  youtube_user_id text,
  current_mood text,
  mood_set_at timestamp with time zone,
  preferred_platform text DEFAULT 'spotify'::text,
  sync_spotify boolean NOT NULL DEFAULT true,
  sync_youtube boolean NOT NULL DEFAULT true,
  sync_tidal boolean NOT NULL DEFAULT true,
  sync_apple_music boolean NOT NULL DEFAULT true,
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_username_key UNIQUE (username)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.radar_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  granted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  invite_id uuid,
  CONSTRAINT radar_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id),
  CONSTRAINT radar_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT radar_access_pkey PRIMARY KEY (id),
  CONSTRAINT radar_access_user_id_key UNIQUE (user_id)
);
ALTER TABLE public.radar_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.radar_artists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  photo_url text,
  genre text[],
  location text,
  status text DEFAULT 'new_find'::text,
  priority text DEFAULT 'medium'::text,
  source_url text,
  source_platform text,
  instagram_url text,
  tiktok_url text,
  twitter_url text,
  soundcloud_url text,
  youtube_url text,
  spotify_url text,
  spotify_artist_id text,
  apple_music_url text,
  distributor text,
  spotify_monthly_listeners integer,
  spotify_followers integer,
  spotify_popularity integer,
  spotify_top_tracks jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  discovered_at date,
  strengths text[],
  CONSTRAINT radar_artists_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
  CONSTRAINT radar_artists_status_check CHECK ((status = ANY (ARRAY['new_find'::text, 'following'::text, 'love'::text]))),
  CONSTRAINT radar_artists_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT radar_artists_pkey PRIMARY KEY (id)
);
ALTER TABLE public.radar_artists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.radar_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  created_by uuid,
  used_by uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  used boolean DEFAULT false,
  CONSTRAINT radar_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  CONSTRAINT radar_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES profiles(id),
  CONSTRAINT radar_invites_pkey PRIMARY KEY (id),
  CONSTRAINT radar_invites_code_key UNIQUE (code)
);
ALTER TABLE public.radar_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.radar_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  artist_id uuid,
  spotify_monthly_listeners integer,
  spotify_followers integer,
  instagram_followers integer,
  tiktok_followers integer,
  youtube_subscribers integer,
  note text,
  recorded_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  CONSTRAINT radar_metrics_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES radar_artists(id) ON DELETE CASCADE,
  CONSTRAINT radar_metrics_pkey PRIMARY KEY (id)
);
ALTER TABLE public.radar_metrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.radar_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  artist_id uuid,
  user_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT radar_notes_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES radar_artists(id) ON DELETE CASCADE,
  CONSTRAINT radar_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
  CONSTRAINT radar_notes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.radar_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  like_id uuid,
  user_id uuid,
  emoji text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reactions_like_id_fkey FOREIGN KEY (like_id) REFERENCES likes(id) ON DELETE CASCADE,
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_like_id_user_id_emoji_key UNIQUE (like_id, user_id, emoji)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid,
  to_user_id uuid,
  track_id uuid,
  message text,
  seen boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recommendations_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES profiles(id),
  CONSTRAINT recommendations_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES profiles(id),
  CONSTRAINT recommendations_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id),
  CONSTRAINT recommendations_pkey PRIMARY KEY (id)
);
-- RLS DISABLED on recommendations

CREATE TABLE public.saved_tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  track_id uuid,
  saved_at timestamp with time zone DEFAULT now(),
  source_user_id uuid,
  source_context text DEFAULT 'feed'::text,
  CONSTRAINT saved_tracks_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES profiles(id),
  CONSTRAINT saved_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT saved_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT saved_tracks_pkey PRIMARY KEY (id),
  CONSTRAINT saved_tracks_user_id_track_id_key UNIQUE (user_id, track_id)
);
ALTER TABLE public.saved_tracks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.search_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  query text,
  results_count integer,
  result_followed uuid,
  searched_at timestamp with time zone DEFAULT now(),
  CONSTRAINT search_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
  CONSTRAINT search_queries_pkey PRIMARY KEY (id)
);
-- RLS DISABLED on search_queries

CREATE TABLE public.share_opens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  track_id uuid,
  opened_at timestamp with time zone DEFAULT now(),
  referrer text,
  user_agent text,
  CONSTRAINT share_opens_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT share_opens_pkey PRIMARY KEY (id)
);
ALTER TABLE public.share_opens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.taglines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  text text NOT NULL,
  weight integer DEFAULT 1,
  category text,
  active boolean DEFAULT true,
  CONSTRAINT taglines_pkey PRIMARY KEY (id)
);
-- RLS DISABLED on taglines

CREATE TABLE public.taste_compatibility (
  user_a uuid,
  user_b uuid,
  score integer,
  calculated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT taste_compatibility_user_a_fkey FOREIGN KEY (user_a) REFERENCES profiles(id),
  CONSTRAINT taste_compatibility_user_b_fkey FOREIGN KEY (user_b) REFERENCES profiles(id),
  CONSTRAINT taste_compatibility_user_a_user_b_key UNIQUE (user_a, user_b)
);
-- RLS DISABLED on taste_compatibility

CREATE TABLE public.taste_profiles (
  user_id uuid NOT NULL,
  top_artists jsonb,
  top_tracks jsonb,
  activity_score integer,
  last_calculated timestamp with time zone DEFAULT now(),
  CONSTRAINT taste_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
  CONSTRAINT taste_profiles_pkey PRIMARY KEY (user_id)
);
-- RLS DISABLED on taste_profiles

CREATE TABLE public.track_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  track_id uuid,
  source_context text,
  mood_context text,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT track_views_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id),
  CONSTRAINT track_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
  CONSTRAINT track_views_pkey PRIMARY KEY (id)
);
-- RLS DISABLED on track_views

CREATE TABLE public.tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  spotify_track_id text NOT NULL,
  title text,
  artist text,
  album text,
  album_art_url text,
  preview_url text,
  created_at timestamp with time zone DEFAULT now(),
  tidal_track_id text,
  apple_music_id text,
  youtube_video_id text,
  short_id text,
  track_source text DEFAULT 'liked'::text,
  isrc text,
  CONSTRAINT tracks_pkey PRIMARY KEY (id),
  CONSTRAINT tracks_spotify_track_id_key UNIQUE (spotify_track_id),
  CONSTRAINT tracks_youtube_video_id_unique UNIQUE (youtube_video_id)
);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_followed_artists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_name text NOT NULL,
  follow_source text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_followed_artists_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_followed_artists_pkey PRIMARY KEY (id)
);
ALTER TABLE public.user_followed_artists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_notification_settings (
  user_id uuid NOT NULL,
  push_follows boolean NOT NULL DEFAULT true,
  push_reactions boolean NOT NULL DEFAULT true,
  push_saves boolean NOT NULL DEFAULT true,
  push_recommendations boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_notification_settings_pkey PRIMARY KEY (user_id)
);
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;


-- ======================================================================
-- INDEXES
-- ======================================================================

CREATE INDEX artist_releases_artist_name_release_date_idx ON public.artist_releases USING btree (artist_name, release_date DESC);

CREATE UNIQUE INDEX artist_releases_spotify_track_id_unique ON public.artist_releases USING btree (spotify_track_id) WHERE (spotify_track_id IS NOT NULL);

CREATE INDEX discover_posts_status_published_at_idx ON public.discover_posts USING btree (status, published_at DESC);

CREATE UNIQUE INDEX likes_user_track_unique ON public.likes USING btree (user_id, track_id);

CREATE INDEX profiles_tidal_user_id_idx ON public.profiles USING btree (tidal_user_id);

CREATE UNIQUE INDEX tracks_apple_music_id_key ON public.tracks USING btree (apple_music_id) WHERE (apple_music_id IS NOT NULL);

CREATE INDEX tracks_isrc_idx ON public.tracks USING btree (isrc) WHERE (isrc IS NOT NULL);

CREATE UNIQUE INDEX tracks_short_id_idx ON public.tracks USING btree (short_id);

CREATE UNIQUE INDEX tracks_youtube_video_id_idx ON public.tracks USING btree (youtube_video_id) WHERE (youtube_video_id IS NOT NULL);

CREATE UNIQUE INDEX user_followed_artists_user_artist_unique ON public.user_followed_artists USING btree (user_id, lower(artist_name));


-- ======================================================================
-- RLS POLICIES
-- ======================================================================

CREATE POLICY "Anyone can view artist releases" ON public.artist_releases AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can view collection exclusions" ON public.collection_exclusions AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete own collection exclusions" ON public.collection_exclusions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own collection exclusions" ON public.collection_exclusions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY developer_notes_select_authenticated ON public.developer_notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can view discover posts" ON public.discover_posts AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "own follows delete" ON public.follows AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = follower_id));

CREATE POLICY "own follows write" ON public.follows AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = follower_id));

CREATE POLICY "public read follows" ON public.follows AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "own likes write" ON public.likes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "public read likes" ON public.likes AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "own profile insert" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "own profile update" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));

CREATE POLICY "public read profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "users can insert own radar access" ON public.radar_access AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "users can read own radar access" ON public.radar_access AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "own radar artists" ON public.radar_artists AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "read invites" ON public.radar_invites AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "own radar metrics" ON public.radar_metrics AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "own radar notes" ON public.radar_notes AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "own reactions delete" ON public.reactions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "own reactions write" ON public.reactions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "public read reactions" ON public.reactions AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "own saved delete" ON public.saved_tracks AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "own saved write" ON public.saved_tracks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "public read saved" ON public.saved_tracks AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "anyone can insert share opens" ON public.share_opens AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "service role can read share opens" ON public.share_opens AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated can view taste compatibility" ON public.taste_compatibility AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can view taste profiles" ON public.taste_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated insert tracks" ON public.tracks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "public read tracks" ON public.tracks AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can insert own followed artists" ON public.user_followed_artists AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own followed artists" ON public.user_followed_artists AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can manage own notification settings" ON public.user_notification_settings AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id));


-- ======================================================================
-- VIEWS
-- ======================================================================

CREATE OR REPLACE VIEW public.feed_likes AS
 SELECT id,
    user_id,
    track_id,
    liked_at,
    created_at
   FROM likes l
  WHERE NOT (EXISTS ( SELECT 1
           FROM hidden_tracks ht
          WHERE ht.track_id = l.track_id AND ht.user_id = l.user_id));

CREATE OR REPLACE VIEW public.profile_views_readable AS
 SELECT pv.id,
    pv.viewed_at,
    pv.tab_viewed,
    viewer.username AS viewer_username,
    viewer.display_name AS viewer_display_name,
    viewed.username AS profile_username,
    viewed.display_name AS profile_display_name
   FROM profile_views pv
     LEFT JOIN profiles viewer ON viewer.id = pv.viewer_id
     LEFT JOIN profiles viewed ON viewed.id = pv.profile_id
  ORDER BY pv.viewed_at DESC;

CREATE OR REPLACE VIEW public.search_queries_readable AS
 SELECT sq.id,
    sq.searched_at,
    sq.query,
    sq.results_count,
    p.username AS viewer_username,
    p.display_name AS viewer_display_name
   FROM search_queries sq
     LEFT JOIN profiles p ON p.id = sq.user_id
  ORDER BY sq.searched_at DESC;

CREATE OR REPLACE VIEW public.track_views_readable AS
 SELECT tv.id,
    tv.viewed_at,
    tv.source_context,
    p.username AS viewer_username,
    p.display_name AS viewer_display_name,
    t.title AS track_title,
    t.artist AS track_artist
   FROM track_views tv
     LEFT JOIN profiles p ON p.id = tv.user_id
     LEFT JOIN tracks t ON t.id = tv.track_id
  ORDER BY tv.viewed_at DESC;


-- ======================================================================
-- FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION public.delete_apple_music_likes(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM likes
  WHERE user_id = p_user_id
    AND track_id IN (
      SELECT id FROM tracks WHERE spotify_track_id LIKE 'apple:%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS SETOF profiles
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT * FROM profiles WHERE id = auth.uid(); $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    display_name = case when profiles.display_name is null then excluded.display_name else profiles.display_name end,
    avatar_url = case when profiles.avatar_url is null then excluded.avatar_url else profiles.avatar_url end;
  return new;
end;
$function$
;


-- ======================================================================
-- TABLE GRANTS to anon / authenticated
-- ======================================================================

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.artist_releases TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.artist_releases TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.collection_exclusions TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.collection_exclusions TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.developer_notes TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.developer_notes TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discover_posts TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discover_posts TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.feed_likes TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.feed_likes TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.follows TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.follows TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.hidden_tracks TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.hidden_tracks TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.likes TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.likes TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_views TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_views TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_views_readable TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_views_readable TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_access TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_access TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_artists TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_artists TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_invites TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_invites TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_metrics TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_metrics TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_notes TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.radar_notes TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reactions TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reactions TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.recommendations TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.recommendations TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.saved_tracks TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.saved_tracks TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.search_queries TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.search_queries TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.search_queries_readable TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.search_queries_readable TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.share_opens TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.share_opens TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taglines TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taglines TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taste_compatibility TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taste_compatibility TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taste_profiles TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taste_profiles TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.track_views TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.track_views TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.track_views_readable TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.track_views_readable TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tracks TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tracks TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_followed_artists TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_followed_artists TO authenticated

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_notification_settings TO anon

-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_notification_settings TO authenticated


-- ======================================================================
-- TRIGGERS on auth.users
-- ======================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
