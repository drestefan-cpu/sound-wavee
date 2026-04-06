export interface DemoUser {
  id: string;
  display_name: string;
  username: string;
  avatar_url: null;
  genre: string;
  follower_count: number;
}

export interface DemoFeedItem {
  id: string;
  user: DemoUser;
  track: {
    title: string;
    artist: string;
    album: string | null;
    spotify_track_id: string;
    album_art_url: string | null;
  };
  time_ago: string;
  reactions: { emoji: string; count: number }[];
}

export const demoUsers: DemoUser[] = [
  { id: "demo-maya", display_name: "maya", username: "maya", avatar_url: null, genre: "indie/alt", follower_count: 342 },
  { id: "demo-jake", display_name: "jake", username: "jake", avatar_url: null, genre: "hip-hop/rap", follower_count: 218 },
  { id: "demo-aisha", display_name: "aisha", username: "aisha", avatar_url: null, genre: "pop/r&b", follower_count: 567 },
  { id: "demo-tom", display_name: "tom", username: "tom", avatar_url: null, genre: "dance/electronic", follower_count: 123 },
  { id: "demo-priya", display_name: "priya", username: "priya", avatar_url: null, genre: "soul/jazz", follower_count: 456 },
  { id: "demo-leo", display_name: "leo", username: "leo", avatar_url: null, genre: "rock/alternative", follower_count: 189 },
];

export const demoFeedItems: DemoFeedItem[] = [
  {
    id: "demo-1",
    user: demoUsers[0],
    track: { title: "Good Luck Babe!", artist: "Chappell Roan", album: null, spotify_track_id: "5DSSlwOFEYBCBUHuNBuZzF", album_art_url: null },
    time_ago: "2 min ago",
    reactions: [{ emoji: "🔥", count: 4 }, { emoji: "😍", count: 2 }],
  },
  {
    id: "demo-2",
    user: demoUsers[1],
    track: { title: "Not Like Us", artist: "Kendrick Lamar", album: null, spotify_track_id: "6AI3ezQ4o3HUoP6Dkdc4T5", album_art_url: null },
    time_ago: "11 min ago",
    reactions: [{ emoji: "💀", count: 7 }, { emoji: "🔥", count: 3 }],
  },
  {
    id: "demo-3",
    user: demoUsers[2],
    track: { title: "Birds of a Feather", artist: "Billie Eilish", album: null, spotify_track_id: "6zurMBuGSBe8CnUBbg8YIh", album_art_url: null },
    time_ago: "1 hr ago",
    reactions: [{ emoji: "✨", count: 8 }, { emoji: "😭", count: 2 }],
  },
  {
    id: "demo-4",
    user: demoUsers[3],
    track: { title: "Espresso", artist: "Sabrina Carpenter", album: null, spotify_track_id: "2qSkIjg1o9h3YT9RAgYN75", album_art_url: null },
    time_ago: "2 hr ago",
    reactions: [{ emoji: "🎵", count: 5 }, { emoji: "😍", count: 3 }],
  },
  {
    id: "demo-5",
    user: demoUsers[4],
    track: { title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", album: null, spotify_track_id: "3ZCTVFBt2Brf31RLEnCkh7", album_art_url: null },
    time_ago: "3 hr ago",
    reactions: [{ emoji: "🔥", count: 6 }, { emoji: "😍", count: 4 }],
  },
];
