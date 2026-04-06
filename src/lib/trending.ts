export interface TrendingTrack {
  position: number;
  title: string;
  artist: string;
  spotifyTrackId: string | null;
  songlink: string;
  albumArtUrl: string | null;
}

function spotifyUrl(id: string | null, title: string, artist: string) {
  if (id) return `https://open.spotify.com/track/${id}`;
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}

export const trendingTracks: TrendingTrack[] = [
  { position: 1, title: "Swim", artist: "BTS", spotifyTrackId: "6PwBMbGBygJZvBILCMWKhv", songlink: "", albumArtUrl: null },
  { position: 2, title: "Choosin' Texas", artist: "Ella Langley", spotifyTrackId: "3qQbCzbPsRBdMJSWu2p1F2", songlink: "", albumArtUrl: null },
  { position: 3, title: "Man I Need", artist: "Olivia Dean", spotifyTrackId: "5enxwA8aAbwZbf5qCHORXi", songlink: "", albumArtUrl: null },
  { position: 4, title: "I Just Might", artist: "Bruno Mars", spotifyTrackId: "3CeCwYWvdfXbZLXFhBrbnf", songlink: "", albumArtUrl: null },
  { position: 5, title: "Ordinary", artist: "Alex Warren", spotifyTrackId: "3HWnxBS4RHnAzFpfOGsJXs", songlink: "", albumArtUrl: null },
  { position: 6, title: "Golden", artist: "HUNTR", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 7, title: "So Easy To Fall In Love", artist: "Olivia Dean", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 8, title: "Stateside", artist: "PinkPantheress ft Zara Larsson", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 9, title: "The Fate of Ophelia", artist: "Taylor Swift", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 10, title: "Folded", artist: "Morgan Wallen", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 11, title: "Lose Control", artist: "Teddy Swims", spotifyTrackId: null, songlink: "", albumArtUrl: null },
  { position: 12, title: "Beautiful Things", artist: "Benson Boone", spotifyTrackId: "3qooMDzAjxNVaF2FguTRFH", songlink: "", albumArtUrl: null },
  { position: 13, title: "Luther", artist: "Kendrick Lamar & SZA", spotifyTrackId: "5jnBTTNMBEAMJGFvSSzpNa", songlink: "", albumArtUrl: null },
  { position: 14, title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", spotifyTrackId: "5AZFMmXNcFO3MRhFEhLgDe", songlink: "", albumArtUrl: null },
  { position: 15, title: "APT", artist: "ROSÉ & Bruno Mars", spotifyTrackId: "5vNRhJkzFHSEEhBVvkBGpM", songlink: "", albumArtUrl: null },
];

// Pre-compute songlinks
trendingTracks.forEach(t => {
  t.songlink = spotifyUrl(t.spotifyTrackId, t.title, t.artist);
});
