export function getTrackUrl(
  platform: string,
  spotifyTrackId?: string,
  title?: string,
  artist?: string,
): string {
  const query = encodeURIComponent(`${title || ""} ${artist || ""}`.trim());
  switch (platform) {
    case "spotify":
      return spotifyTrackId
        ? `https://open.spotify.com/track/${spotifyTrackId}`
        : `https://open.spotify.com/search/${query}`;
    case "apple_music":
      return `https://music.apple.com/search?term=${query}`;
    case "youtube_music":
      return `https://music.youtube.com/search?q=${query}`;
    case "tidal":
      return `https://tidal.com/search?q=${query}`;
    default:
      return spotifyTrackId
        ? `https://open.spotify.com/track/${spotifyTrackId}`
        : `https://open.spotify.com/search/${query}`;
  }
}
