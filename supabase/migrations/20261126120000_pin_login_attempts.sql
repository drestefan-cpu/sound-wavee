-- PIN sign-in now goes through the pin-login function (works for every account type).
-- It logs each try here so a username gets locked for 15 minutes after 5 wrong PINs.
CREATE TABLE IF NOT EXISTS public.pin_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  ok boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pin_login_attempts_username_time ON public.pin_login_attempts (username, created_at DESC);
ALTER TABLE public.pin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pin_login_attempts FROM anon, authenticated;
-- (no policies: only the pin-login function, using the service key, reads or writes it)
