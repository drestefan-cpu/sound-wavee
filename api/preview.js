// Link-preview page for PLAI share links (iMessage, WhatsApp, Slack, X, etc.).
//
//   /s/:shortId   → looks up the track by short_id
//   /song/:id     → looks up the track by id
//
// Returns a tiny HTML page whose Open Graph tags carry the song's title, artist and
// album art (what iMessage shows), then immediately forwards people to the song in PLAI.
// Only link-preview robots are sent here (see vercel.json); people go straight to the app.

const APP_URL = "https://plai.delaneyprojects.xyz";
const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
// Public anon key — the same one the PLAI web app ships with. Read-only access to public tables.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";
const DEFAULT_IMAGE = `${APP_URL}/plai-icon.png`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_RE = /^[a-z0-9]{4,12}$/i;
const USERNAME_RE = /^[a-z0-9._-]{1,40}$/i;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function findTrack({ id, shortId }) {
  const filter = id ? `id=eq.${id}` : `short_id=eq.${shortId}`;
  const url = `${SUPABASE_URL}/rest/v1/tracks?select=id,title,artist,album,album_art_url&${filter}&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

function renderPage({ title, description, image, pageUrl, redirectUrl, type }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const page = escapeHtml(pageUrl);
  const go = escapeHtml(redirectUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta property="og:site_name" content="PLAI" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:url" content="${page}" />
  <meta property="og:type" content="${type}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  <link rel="canonical" href="${page}" />
  <meta http-equiv="refresh" content="0;url=${go}" />
  <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080B12;color:#9aa8b8;font:14px system-ui,sans-serif}a{color:#ff2d78}</style>
</head>
<body>
  <p>Opening in PLAI… <a href="${go}">tap here</a> if nothing happens.</p>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const rawId = url.searchParams.get("id");
  const rawShort = url.searchParams.get("short");
  const rawFrom = url.searchParams.get("from");

  const id = rawId && UUID_RE.test(rawId) ? rawId : null;
  const shortId = !id && rawShort && SHORT_ID_RE.test(rawShort) ? rawShort : null;
  const from = rawFrom && USERNAME_RE.test(rawFrom) ? rawFrom.toLowerCase() : null;
  const pageUrl = `https://${req.headers.host}${url.pathname}${from ? `?from=${from}` : ""}`;

  let track = null;
  if (id || shortId) {
    try {
      track = await findTrack({ id, shortId });
    } catch {
      track = null;
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!track) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(
      renderPage({
        title: "PLAI",
        description: "i love your taste",
        image: DEFAULT_IMAGE,
        pageUrl,
        redirectUrl: APP_URL,
        type: "website",
      }),
    );
    return;
  }

  const songUrl = `${APP_URL}/song/${track.id}${from ? `?from=${from}` : ""}`;
  // Cache at the edge for an hour; previews rarely change
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  res.status(200).send(
    renderPage({
      title: `${track.title} — ${track.artist}`,
      description: from
        ? `${from} shared this on PLAI${track.album ? ` · ${track.album}` : ""}`
        : track.album
          ? `${track.album} · on PLAI`
          : `${track.artist} on PLAI`,
      image: track.album_art_url || DEFAULT_IMAGE,
      pageUrl,
      redirectUrl: songUrl,
      type: "music.song",
    }),
  );
}
