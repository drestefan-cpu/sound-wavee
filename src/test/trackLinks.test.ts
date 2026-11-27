import { describe, expect, it } from "vitest";
import { getRealSpotifyId, getTrackPlatform, getTrackUrl } from "@/lib/trackLinks";

// Play buttons must open the exact song when PLAI knows it, and never a broken placeholder ID.
describe("play links", () => {
  it("knows which app a song came from", () => {
    expect(getTrackPlatform("4uLU6hMCjMI75M1A2tKUQC")).toBe("spotify");
    expect(getTrackPlatform("apple:1448780200")).toBe("apple");
    expect(getTrackPlatform("tidal_12345")).toBe("tidal");
    expect(getTrackPlatform("yt:dQw4w9WgXcQ")).toBe("youtube");
  });

  it("never opens a placeholder ID in Spotify", () => {
    expect(getRealSpotifyId("tidal_12345")).toBeUndefined();
    expect(getRealSpotifyId("apple:1", "realSpotifyId")).toBe("realSpotifyId");
    expect(getTrackUrl("spotify", "tidal_12345", "Song", "Artist")).toBe("https://open.spotify.com/search/Song%20Artist");
  });

  it("opens the exact song on each app when the ID is known", () => {
    expect(getTrackUrl("spotify", "abc")).toBe("https://open.spotify.com/track/abc");
    expect(getTrackUrl("apple_music", "apple:99")).toBe("https://music.apple.com/us/song/99");
    expect(getTrackUrl("tidal", undefined, "", "", null, null, "555")).toBe("https://tidal.com/browse/track/555");
    expect(getTrackUrl("youtube_music", "yt:vid123")).toBe("https://music.youtube.com/watch?v=vid123");
  });

  it("falls back to a search when the song isn't known on that app", () => {
    expect(getTrackUrl("apple_music", "abc", "Unicorn Purp", "Future")).toBe(
      "https://music.apple.com/search?term=Unicorn%20Purp%20Future",
    );
  });
});
