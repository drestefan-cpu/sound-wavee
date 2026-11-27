-- Account deletion: deleting someone removes everything tied to them (or unlinks it where
-- another person's data points at them, e.g. "saved from @x"). Before this, these links blocked
-- deleting an account. The delete-account function deletes the sign-in, which cascades from here.

ALTER TABLE public.radar_access DROP CONSTRAINT IF EXISTS radar_access_granted_by_fkey;
ALTER TABLE public.radar_access ADD CONSTRAINT radar_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.saved_tracks DROP CONSTRAINT IF EXISTS saved_tracks_source_user_id_fkey;
ALTER TABLE public.saved_tracks ADD CONSTRAINT saved_tracks_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.taste_profiles DROP CONSTRAINT IF EXISTS taste_profiles_user_id_fkey;
ALTER TABLE public.taste_profiles ADD CONSTRAINT taste_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.taste_compatibility DROP CONSTRAINT IF EXISTS taste_compatibility_user_a_fkey;
ALTER TABLE public.taste_compatibility ADD CONSTRAINT taste_compatibility_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.taste_compatibility DROP CONSTRAINT IF EXISTS taste_compatibility_user_b_fkey;
ALTER TABLE public.taste_compatibility ADD CONSTRAINT taste_compatibility_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_from_user_id_fkey;
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_to_user_id_fkey;
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.radar_invites DROP CONSTRAINT IF EXISTS radar_invites_created_by_fkey;
ALTER TABLE public.radar_invites ADD CONSTRAINT radar_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.radar_invites DROP CONSTRAINT IF EXISTS radar_invites_used_by_fkey;
ALTER TABLE public.radar_invites ADD CONSTRAINT radar_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profile_views DROP CONSTRAINT IF EXISTS profile_views_viewer_id_fkey;
ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profile_views DROP CONSTRAINT IF EXISTS profile_views_profile_id_fkey;
ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.track_views DROP CONSTRAINT IF EXISTS track_views_user_id_fkey;
ALTER TABLE public.track_views ADD CONSTRAINT track_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.search_queries DROP CONSTRAINT IF EXISTS search_queries_user_id_fkey;
ALTER TABLE public.search_queries ADD CONSTRAINT search_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.radar_notes DROP CONSTRAINT IF EXISTS radar_notes_user_id_fkey;
ALTER TABLE public.radar_notes ADD CONSTRAINT radar_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
