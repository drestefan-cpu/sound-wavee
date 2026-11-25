-- Background sync: every 2 hours, call the sync-all function, which syncs every connected music
-- app for everyone. The shared secret lives in Vault (name 'cron_secret') and in the function's
-- CRON_SECRET setting; it's never stored in this file.
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('sync-all-every-2h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-all-every-2h');
SELECT cron.schedule(
  'sync-all-every-2h',
  '15 */2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);

-- Result of each background sync, per person and app (kept 14 days) — so a broken connection
-- (e.g. an expired Spotify login) is visible instead of silently showing nothing new.
CREATE TABLE IF NOT EXISTS public.sync_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status int,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_log FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS sync_log_created_idx ON public.sync_log (created_at DESC);
