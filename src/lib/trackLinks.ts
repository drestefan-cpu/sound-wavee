/** Returns true when the stored spotify_track_id is a YouTube sentinel (e.g. "yt:abc123") */
export function isYouTubeSentinel(spotifyTrackId?: string): boolean {
  return !!spotifyTrackId && spotifyTrackId.startsWith("yt:");
}

/** Extracts the YouTube video ID from a sentinel value, or null if not applicable */
export function extractYouTubeVideoId(spotifyTrackId?: string): string | null {
  if (!isYouTubeSentinel(spotifyTrackId)) return null;
  return spotifyTrackId!.slice(3) || null;
}

export type TrackPlatform = "spotify" | "apple" | "youtube" | "tidal";

export const PLATFORM_LABELS: Record<TrackPlatform, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube Music",
  tidal: "Tidal",
};

/** Which platform a track was synced from, based on the spotify_track_id prefix */
export function getTrackPlatform(spotifyTrackId?: string | null): TrackPlatform {
  if (spotifyTrackId?.startsWith("yt:")) return "youtube";
  if (spotifyTrackId?.startsWith("apple:")) return "apple";
  if (spotifyTrackId?.startsWith("tidal_")) return "tidal";
  return "spotify";
}

/** Returns the stored ID only if it's a real Spotify track ID (not a yt:/apple:/tidal_/share: placeholder) */
export function getRealSpotifyId(spotifyTrackId?: string): string | undefined {
  if (!spotifyTrackId) return undefined;
  if (/^(yt:|apple:|tidal_|share:)/.test(spotifyTrackId)) return undefined;
  return spotifyTrackId;
}

/** Apple Music catalog ID from the apple_music_id column, or from an "apple:" sentinel */
export function getAppleMusicId(spotifyTrackId?: string, appleMusicId?: string | null): string | null {
  if (appleMusicId) return appleMusicId;
  if (spotifyTrackId?.startsWith("apple:")) return spotifyTrackId.slice(6) || null;
  return null;
}

export function getTrackUrl(
  platform: string,
  spotifyTrackId?: string,
  title?: string,
  artist?: string,
  appleMusicId?: string | null,
): string {
  const query = encodeURIComponent(`${title || ""} ${artist || ""}`.trim());
  const realSpotifyId = getRealSpotifyId(spotifyTrackId);
  const ytVideoId = extractYouTubeVideoId(spotifyTrackId);
  const appleId = getAppleMusicId(spotifyTrackId, appleMusicId);

  switch (platform) {
    case "spotify":
      return realSpotifyId
        ? `https://open.spotify.com/track/${realSpotifyId}`
        : `https://open.spotify.com/search/${query}`;
    case "apple_music":
      return appleId
        ? `https://music.apple.com/us/song/${appleId}`
        : `https://music.apple.com/search?term=${query}`;
    case "youtube_music":
      // Direct watch URL for YouTube-sourced tracks; search otherwise
      return ytVideoId
        ? `https://music.youtube.com/watch?v=${ytVideoId}`
        : `https://music.youtube.com/search?q=${query}`;
    case "tidal":
      return `https://tidal.com/search?q=${query}`;
    default:
      return realSpotifyId
        ? `https://open.spotify.com/track/${realSpotifyId}`
        : `https://open.spotify.com/search/${query}`;
  }
}
