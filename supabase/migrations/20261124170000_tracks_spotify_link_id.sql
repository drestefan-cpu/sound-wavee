-- Real Spotify track ID for songs that came from another platform (Tidal, Apple Music, YouTube).
-- spotify_track_id holds a placeholder for those rows ("tidal_…", "apple:…", "yt:…"), so play
-- buttons and links use spotify_link_id to open the exact song in Spotify. Filled by the syncs
-- via an ISRC lookup.
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS spotify_link_id text;
