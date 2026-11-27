import { afterEach, describe, expect, it, vi } from "vitest";
// The serverless function that gives iMessage / WhatsApp their link previews
import handler from "../../api/preview.js";

const run = async (url: string) => {
  const out: { status?: number; body?: string } = {};
  const res = {
    setHeader: () => {},
    status(code: number) {
      out.status = code;
      return this;
    },
    send(body: string) {
      out.body = body;
    },
  };
  await handler({ url, headers: { host: "plai.delaneyprojects.xyz" } }, res);
  return out;
};

const mockDatabase = (rows: unknown[]) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }));

describe("link previews", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the song's title, artist and artwork", async () => {
    mockDatabase([{ id: "11111111-1111-1111-1111-111111111111", title: "Unicorn Purp", artist: "Future", album: null, album_art_url: "https://i.scdn.co/x" }]);
    const { status, body } = await run("/api/preview?short=8ma640&from=dre.stefan");
    expect(status).toBe(200);
    expect(body).toContain("<title>Unicorn Purp — Future</title>");
    expect(body).toContain('content="https://i.scdn.co/x"');
    expect(body).toContain("dre.stefan shared this on PLAI");
  });

  it("shows who sent an invite", async () => {
    mockDatabase([{ username: "dre.stefan", display_name: null, avatar_url: "https://i.scdn.co/me" }]);
    const { body } = await run("/api/preview?join=dre.stefan");
    expect(body).toContain("@dre.stefan invited you to PLAI");
    expect(body).toContain("/join/dre.stefan");
  });

  it("escapes song titles so they can't break the page", async () => {
    mockDatabase([{ id: "11111111-1111-1111-1111-111111111111", title: '<script>"x"</script>', artist: "A", album: null, album_art_url: null }]);
    const { body } = await run("/api/preview?short=abcd12");
    expect(body).not.toContain("<script>\"x\"");
    expect(body).toContain("&lt;script&gt;");
  });

  it("falls back to a plain PLAI preview for unknown links", async () => {
    mockDatabase([]);
    const { body } = await run("/api/preview?short=zzzz99");
    expect(body).toContain("<title>PLAI</title>");
  });
});
