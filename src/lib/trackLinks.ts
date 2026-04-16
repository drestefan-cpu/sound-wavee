/** Returns true when the stored spotify_track_id is a YouTube sentinel (e.g. "yt:abc123") */
export function isYouTubeSentinel(spotifyTrackId?: string): boolean {
  return !!spotifyTrackId && spotifyTrackId.startsWith("yt:");
}

/** Extracts the YouTube video ID from a sentinel value, or null if not applicable */
export function extractYouTubeVideoId(spotifyTrackId?: string): string | null {
  if (!isYouTubeSentinel(spotifyTrackId)) return null;
  return spotifyTrackId!.slice(3) || null;
}

export function getTrackUrl(
  platform: string,
  spotifyTrackId?: string,
  title?: string,
  artist?: string,
): string {
  const query = encodeURIComponent(`${title || ""} ${artist || ""}`.trim());
  const realSpotifyId = spotifyTrackId && !isYouTubeSentinel(spotifyTrackId) ? spotifyTrackId : undefined;
  const ytVideoId = extractYouTubeVideoId(spotifyTrackId);

  switch (platform) {
    case "spotify":
      return realSpotifyId
        ? `https://open.spotify.com/track/${realSpotifyId}`
        : `https://open.spotify.com/search/${query}`;
    case "apple_music":
      return `https://music.apple.com/search?term=${query}`;
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
