export interface TrendingTrack {
  position: number;
  title: string;
  artist: string;
  spotifyTrackId: string;
  songlink: string;
  albumArtUrl: string | null;
}

function spotifyUrl(id: string) {
  return `https://open.spotify.com/track/${id}`;
}

export const trendingTracks: TrendingTrack[] = [
  { position: 1, title: "Swim", artist: "BTS", spotifyTrackId: "6PwBMbGBygJZvBILCMWKhv", songlink: "", albumArtUrl: null },
  { position: 2, title: "Choosin' Texas", artist: "Ella Langley", spotifyTrackId: "3qQbCzbPsRBdMJSWu2p1F2", songlink: "", albumArtUrl: null },
  { position: 3, title: "Man I Need", artist: "Olivia Dean", spotifyTrackId: "5enxwA8aAbwZbf5qCHORXi", songlink: "", albumArtUrl: null },
  { position: 4, title: "I Just Might", artist: "Bruno Mars", spotifyTrackId: "3CeCwYWvdfXbZLXFhBrbnf", songlink: "", albumArtUrl: null },
  { position: 5, title: "Ordinary", artist: "Alex Warren", spotifyTrackId: "3HWnxBS4RHnAzFpfOGsJXs", songlink: "", albumArtUrl: null },
  { position: 6, title: "Beautiful Things", artist: "Benson Boone", spotifyTrackId: "3qooMDzAjxNVaF2FguTRFH", songlink: "", albumArtUrl: null },
  { position: 7, title: "Luther", artist: "Kendrick Lamar & SZA", spotifyTrackId: "5jnBTTNMBEAMJGFvSSzpNa", songlink: "", albumArtUrl: null },
  { position: 8, title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", spotifyTrackId: "5AZFMmXNcFO3MRhFEhLgDe", songlink: "", albumArtUrl: null },
  { position: 9, title: "APT.", artist: "ROSÉ & Bruno Mars", spotifyTrackId: "5vNRhJkzFHSEEhBVvkBGpM", songlink: "", albumArtUrl: null },
  { position: 10, title: "The Fate of Ophelia", artist: "Taylor Swift", spotifyTrackId: "4MRHAMQlxSMPBMxHNBhGCH", songlink: "", albumArtUrl: null },
  { position: 11, title: "Lose Control", artist: "Teddy Swims", spotifyTrackId: "3YFDMNaGFvBMnHsOGrgaBl", songlink: "", albumArtUrl: null },
  { position: 12, title: "Stateside", artist: "PinkPantheress ft Zara Larsson", spotifyTrackId: "6lXKNdOsnaLv9LwulZbxNl", songlink: "", albumArtUrl: null },
  { position: 13, title: "Folded", artist: "Morgan Wallen", spotifyTrackId: "5oCFCBbal7N9RqM0HMpDaS", songlink: "", albumArtUrl: null },
  { position: 14, title: "Golden", artist: "HUNTR", spotifyTrackId: "6PgADvXZUCFfvWuiiuTggw", songlink: "", albumArtUrl: null },
  { position: 15, title: "So Easy (To Fall In Love)", artist: "Olivia Dean", spotifyTrackId: "4xpDQBOBmQgRzYGNIxFMdj", songlink: "", albumArtUrl: null },
];

// Pre-compute songlinks
trendingTracks.forEach(t => {
  t.songlink = spotifyUrl(t.spotifyTrackId);
});
