export interface TrendingTrack {
  position: number;
  title: string;
  artist: string;
  songlink: string;
}

function spotifySearch(title: string, artist: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}

export const trendingTracks: TrendingTrack[] = [
  { position: 1, title: "Swim", artist: "BTS", songlink: spotifySearch("Swim", "BTS") },
  { position: 2, title: "Choosin' Texas", artist: "Ella Langley", songlink: spotifySearch("Choosin' Texas", "Ella Langley") },
  { position: 3, title: "Man I Need", artist: "Olivia Dean", songlink: spotifySearch("Man I Need", "Olivia Dean") },
  { position: 4, title: "I Just Might", artist: "Bruno Mars", songlink: spotifySearch("I Just Might", "Bruno Mars") },
  { position: 5, title: "Ordinary", artist: "Alex Warren", songlink: spotifySearch("Ordinary", "Alex Warren") },
  { position: 6, title: "Golden", artist: "HUNTR", songlink: spotifySearch("Golden", "HUNTR") },
  { position: 7, title: "So Easy To Fall In Love", artist: "Olivia Dean", songlink: spotifySearch("So Easy To Fall In Love", "Olivia Dean") },
  { position: 8, title: "Stateside", artist: "PinkPantheress ft Zara Larsson", songlink: spotifySearch("Stateside", "PinkPantheress Zara Larsson") },
  { position: 9, title: "The Fate of Ophelia", artist: "Taylor Swift", songlink: spotifySearch("The Fate of Ophelia", "Taylor Swift") },
  { position: 10, title: "Folded", artist: "Morgan Wallen", songlink: spotifySearch("Folded", "Morgan Wallen") },
  { position: 11, title: "Lose Control", artist: "Teddy Swims", songlink: spotifySearch("Lose Control", "Teddy Swims") },
  { position: 12, title: "Beautiful Things", artist: "Benson Boone", songlink: spotifySearch("Beautiful Things", "Benson Boone") },
  { position: 13, title: "Luther", artist: "Kendrick Lamar & SZA", songlink: spotifySearch("Luther", "Kendrick Lamar SZA") },
  { position: 14, title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", songlink: spotifySearch("Die With A Smile", "Lady Gaga Bruno Mars") },
  { position: 15, title: "APT", artist: "ROSÉ & Bruno Mars", songlink: spotifySearch("APT", "ROSÉ Bruno Mars") },
];
