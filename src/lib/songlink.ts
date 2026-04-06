export function getSpotifyUrl(spotifyTrackId?: string, title?: string, artist?: string): string {
  if (spotifyTrackId) {
    return `https://open.spotify.com/track/${spotifyTrackId}`;
  }
  const query = encodeURIComponent(`${title || ""} ${artist || ""}`.trim());
  return `https://open.spotify.com/search/${query}`;
}

export const getSonglinkUrl = getSpotifyUrl;
