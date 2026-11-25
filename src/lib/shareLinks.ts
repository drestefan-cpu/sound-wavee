/**
 * Public share links go through the share-preview service (share-preview/ on Vercel),
 * which serves rich link previews (album art, title) for iMessage etc. and then
 * forwards to the song page in the app.
 */
export const SHARE_BASE_URL = "https://plai.delaneyprojects.xyz";

/** The app's public address (same site as the share links) */
export const APP_URL = SHARE_BASE_URL;

/** Install page for the "Share with PLAI" iPhone shortcut (share-preview/shortcut/) */
export const SHORTCUT_INSTALL_URL = `${SHARE_BASE_URL}/shortcut`;

/** iPhone / iPad (including iPadOS, which reports itself as a Mac) */
export const isAppleMobile = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function songShareUrl(
  trackId: string,
  opts: { shortId?: string | null; from?: string | null } = {},
): string {
  const path = opts.shortId ? `/s/${opts.shortId}` : `/song/${trackId}`;
  const from = opts.from ? `?from=${encodeURIComponent(opts.from.toLowerCase())}` : "";
  return `${SHARE_BASE_URL}${path}${from}`;
}
