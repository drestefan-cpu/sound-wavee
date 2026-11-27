import { describe, expect, it } from "vitest";
import { suggestUsername } from "@/lib/username";

describe("username suggestions", () => {
  it("turns a name into a username", () => {
    expect(suggestUsername("André Delaney")).toBe("andre.delaney");
    expect(suggestUsername("  Jannie  Chang ")).toBe("jannie.chang");
  });
  it("drops characters usernames can't have", () => {
    expect(suggestUsername("Tyler, The Creator!")).toBe("tyler.the.creator");
    expect(suggestUsername("🎧 dj ✨")).toBe("dj");
    expect(suggestUsername("j. cole")).toBe("j.cole");
  });
  it("keeps it short", () => {
    expect(suggestUsername("a".repeat(40))).toHaveLength(24);
  });
});
