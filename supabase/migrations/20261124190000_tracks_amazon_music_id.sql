-- Amazon Music track ID (ASIN, e.g. "B0C1234567"). Play/share buttons open
-- music.amazon.com/tracks/<id> when it's known and fall back to an Amazon Music search otherwise.
-- Amazon has no public catalogue API; IDs can be filled once a song.link (Odesli) API key or
-- Amazon Music Web API access is available.
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS amazon_music_id text;
