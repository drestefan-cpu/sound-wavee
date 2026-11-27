-- The scheduled jobs keep a row per run (about 110 a day, mostly the 15-minute push check).
-- Keep the last 7 days so the history never grows without limit.
SELECT cron.unschedule('prune-cron-history') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-cron-history');
SELECT cron.schedule('prune-cron-history', '30 3 * * *',
  $cron$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; $cron$);
