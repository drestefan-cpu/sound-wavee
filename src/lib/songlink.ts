export function getSonglinkUrl(spotifyTrackId?: string, title?: string, artist?: string): string {
  if (spotifyTrackId) {
    return `https://song.link/s/${spotifyTrackId}`;
  }
  const query = encodeURIComponent(`${title || ""} ${artist || ""}`.trim());
  return `https://song.link/search?query=${query}`;
}
