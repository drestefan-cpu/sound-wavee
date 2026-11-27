import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearInvite, inviteLink, pendingInvite, rememberInvite } from "@/lib/invite";

describe("invite links", () => {
  beforeEach(() => localStorage.clear());

  it("builds the link from a username", () => {
    expect(inviteLink("dre.stefan")).toBe("https://plai.delaneyprojects.xyz/join/dre.stefan");
  });

  it("remembers who invited you through sign-up", () => {
    rememberInvite("Dre.Stefan");
    expect(pendingInvite()).toBe("dre.stefan");
    clearInvite();
    expect(pendingInvite()).toBeNull();
  });

  it("forgets invites older than 14 days", () => {
    rememberInvite("dre.stefan");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 15 * 86400_000);
    expect(pendingInvite()).toBeNull();
    vi.restoreAllMocks();
  });
});
