-- Push notifications (lock-screen alerts on phones with PLAI on the home screen, and browsers).
-- Each device that turns notifications on saves a subscription here. New notifications are sent
-- by the send-push function: most straight away, "added new music" grouped every 15 minutes.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon;

DROP POLICY IF EXISTS "push: own devices" ON public.push_subscriptions;
CREATE POLICY "push: own devices" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Save (or move to this account) a device's subscription. A device that was used by another
-- account before belongs to whoever is signed in now.
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_device, 80))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = auth.uid(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device = EXCLUDED.device;
$$;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Call send-push (secret from Vault; never in this file)
CREATE OR REPLACE FUNCTION public.call_send_push(p_body jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://sylwprldxdgbsncwyhfk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := p_body,
    timeout_milliseconds := 10000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.call_send_push(jsonb) FROM PUBLIC, anon, authenticated;

-- New notification → push it now (except "added new music", which is grouped below)
CREATE OR REPLACE FUNCTION public.push_on_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type <> 'new_music' AND EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id) THEN
    PERFORM call_send_push(jsonb_build_object('notification_id', NEW.id));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_on_notification failed: %', SQLERRM;  -- never block the notification itself
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.push_on_notification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;
CREATE TRIGGER push_on_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

-- Every 15 minutes: one grouped push per friend who added music ("@jan added 3 new songs")
SELECT cron.unschedule('push-new-music') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-new-music');
SELECT cron.schedule(
  'push-new-music',
  '*/15 * * * *',
  $cron$
  SELECT public.call_send_push('{"mode":"new_music"}'::jsonb)
   WHERE EXISTS (
     SELECT 1 FROM public.notifications n JOIN public.push_subscriptions s ON s.user_id = n.user_id
      WHERE n.type = 'new_music' AND n.pushed_at IS NULL AND n.read = false
        AND n.created_at > now() - interval '6 hours'
   );
  $cron$
);
