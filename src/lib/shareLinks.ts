/**
 * Public share links go through the share-preview service (share-preview/ on Vercel),
 * which serves rich link previews (album art, title) for iMessage etc. and then
 * forwards to the song page in the app.
 */
export const SHARE_BASE_URL = "https://plai.delaneyprojects.xyz";

export function songShareUrl(
  trackId: string,
  opts: { shortId?: string | null; from?: string | null } = {},
): string {
  const path = opts.shortId ? `/s/${opts.shortId}` : `/song/${trackId}`;
  const from = opts.from ? `?from=${encodeURIComponent(opts.from.toLowerCase())}` : "";
  return `${SHARE_BASE_URL}${path}${from}`;
}
