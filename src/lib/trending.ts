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
  { position: 1, title: "Swim", artist: "BTS", spotifyTrackId: "6PwBMbGBygJZvBILCMWKhv", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b2737b4ee428f4d8f27260dc9f31" },
  { position: 2, title: "Choosin' Texas", artist: "Ella Langley", spotifyTrackId: "3qQbCzbPsRBdMJSWu2p1F2", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273c1b36aea5c34a5e8ca6cf1c3" },
  { position: 3, title: "Man I Need", artist: "Olivia Dean", spotifyTrackId: "5enxwA8aAbwZbf5qCHORXi", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273e4ca00f4ff70c0fae5f0e61c" },
  { position: 4, title: "I Just Might", artist: "Bruno Mars", spotifyTrackId: "3CeCwYWvdfXbZLXFhBrbnf", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b2739478c87599550dd73bfa7e02" },
  { position: 5, title: "Ordinary", artist: "Alex Warren", spotifyTrackId: "3HWnxBS4RHnAzFpfOGsJXs", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273c5649a1e3b5dd66ec5b7c2f1" },
  { position: 6, title: "Beautiful Things", artist: "Benson Boone", spotifyTrackId: "3qooMDzAjxNVaF2FguTRFH", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273d9f1c73d43f04e14df2e9f0a" },
  { position: 7, title: "Luther", artist: "Kendrick Lamar & SZA", spotifyTrackId: "5jnBTTNMBEAMJGFvSSzpNa", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273af1c0e624f7d0f6dcc3e35c9" },
  { position: 8, title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", spotifyTrackId: "5AZFMmXNcFO3MRhFEhLgDe", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273b3f3d9f43b09c7e9e8c3d7f1" },
  { position: 9, title: "APT.", artist: "ROSÉ & Bruno Mars", spotifyTrackId: "5vNRhJkzFHSEEhBVvkBGpM", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273c1a7a27e47dabd4d24fa5d64" },
  { position: 10, title: "The Fate of Ophelia", artist: "Taylor Swift", spotifyTrackId: "4MRHAMQlxSMPBMxHNBhGCH", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a" },
  { position: 11, title: "Lose Control", artist: "Teddy Swims", spotifyTrackId: "3YFDMNaGFvBMnHsOGrgaBl", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b2731b9e4a4e3b8c17f32c77cf4c" },
  { position: 12, title: "Stateside", artist: "PinkPantheress ft Zara Larsson", spotifyTrackId: "6lXKNdOsnaLv9LwulZbxNl", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273f1a4e5c6b7d8e9f0a1b2c3d4" },
  { position: 13, title: "Folded", artist: "Morgan Wallen", spotifyTrackId: "5oCFCBbal7N9RqM0HMpDaS", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273e5f6a7b8c9d0e1f2a3b4c5d6" },
  { position: 14, title: "Golden", artist: "HUNTR", spotifyTrackId: "6PgADvXZUCFfvWuiiuTggw", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273b4c5d6e7f8a9b0c1d2e3f4a5" },
  { position: 15, title: "So Easy", artist: "Olivia Dean", spotifyTrackId: "4xpDQBOBmQgRzYGNIxFMdj", songlink: "", albumArtUrl: "https://i.scdn.co/image/ab67616d0000b273e4ca00f4ff70c0fae5f0e61c" },
];

// Pre-compute songlinks
trendingTracks.forEach(t => {
  t.songlink = spotifyUrl(t.spotifyTrackId);
});
