
-- Add login_pin column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_pin text;

-- Function to set a hashed PIN
CREATE OR REPLACE FUNCTION public.set_login_pin(p_user_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET login_pin = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

-- Function to verify PIN by email
CREATE OR REPLACE FUNCTION public.verify_login_pin(p_email text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin text;
  user_id uuid;
BEGIN
  -- Look up user by email in auth.users
  SELECT au.id INTO user_id
  FROM auth.users au
  WHERE au.email = p_email;
  
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT p.login_pin INTO stored_pin
  FROM public.profiles p
  WHERE p.id = user_id;
  
  IF stored_pin IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_pin = crypt(p_pin, stored_pin);
END;
$$;
