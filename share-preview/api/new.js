// "Make a PLAI link" endpoint for the iPhone "Share with PLAI" shortcut (and anything else
// that wants a simple GET):
//
//   GET https://plai.delaneyprojects.xyz/new?url=<Spotify / Apple Music / Tidal / YouTube / … link>[&from=<PLAI username>]
//   → 200 text/plain  https://plai.delaneyprojects.xyz/s/abc123[?from=username]
//   → 4xx text/plain  a short, human-readable reason
//
// It calls PLAI's create-share-link function with the public app key, so the shortcut itself
// needs no keys or JSON.

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
// Public anon key — the same one the PLAI web app ships with.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

const USERNAME_RE = /^[a-z0-9._-]{1,40}$/i;

// Shared text is often "Check out this song! https://…" — pull out the first link
const firstUrl = (value) => (String(value || "").match(/https?:\/\/[^\s<>"']+/) || [])[0] || null;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const url = new URL(req.url, `https://${req.headers.host}`);
  const songUrl = firstUrl(url.searchParams.get("url"));
  if (!songUrl) {
    res.status(400).send("Share a song link from Spotify, Apple Music, Tidal, YouTube Music or similar.");
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/create-share-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url: songUrl }),
    });
    const data = await r.json().catch(() => ({}));
    const link = data.short_url || data.share_url;
    if (!data.success || !link) {
      res.status(422).send(data.error || "Couldn't find that song — try sharing a single track.");
      return;
    }
    // Optional sharer name → the preview says "<username> shared this"
    const from = (url.searchParams.get("from") || "").trim().replace(/^@/, "");
    const withFrom = from && USERNAME_RE.test(from) && data.short_url
      ? `${data.short_url}?from=${encodeURIComponent(from.toLowerCase())}`
      : link;
    res.status(200).send(withFrom);
  } catch {
    res.status(502).send("PLAI is unreachable right now — try again in a moment.");
  }
}
