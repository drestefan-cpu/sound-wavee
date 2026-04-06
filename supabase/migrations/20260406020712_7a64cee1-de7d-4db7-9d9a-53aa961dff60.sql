
-- Add token columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotify_access_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotify_refresh_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Enable pgcrypto for later PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
