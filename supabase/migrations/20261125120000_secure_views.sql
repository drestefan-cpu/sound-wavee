-- Security advisor fixes (2026-11-25)
--
-- 1. Four views ran as SECURITY DEFINER (with the view owner's rights), so they ignored the
--    row-level security on the tables underneath. Anyone with the public key could read search
--    history, who viewed whose profile, and who viewed which songs, with usernames.
--    → Run them with the caller's rights (security_invoker), so table rules apply.
--    → The three analytics views are for the dashboard only: no app access at all.
ALTER VIEW public.feed_likes SET (security_invoker = true);
ALTER VIEW public.track_views_readable SET (security_invoker = true);
ALTER VIEW public.profile_views_readable SET (security_invoker = true);
ALTER VIEW public.search_queries_readable SET (security_invoker = true);

REVOKE ALL ON public.track_views_readable FROM anon, authenticated;
REVOKE ALL ON public.profile_views_readable FROM anon, authenticated;
REVOKE ALL ON public.search_queries_readable FROM anon, authenticated;

-- 2. handle_new_user is the sign-up trigger; it must not be callable as an API function,
--    and it should resolve table names from a fixed schema.
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
