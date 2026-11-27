/**
 * Runs before anything else (first import in main.tsx). When someone comes back from Spotify's
 * sign-in with an error, remember why, so PLAI can explain it instead of silently showing the
 * start screen. The usual cause: PLAI's Spotify app is in development mode and only lets people
 * on its allowlist connect.
 */

export const OAUTH_ATTEMPT_KEY = "plai-oauth-attempt";
export const SPOTIFY_BLOCKED_KEY = "plai-spotify-blocked";

/** Call right before sending someone to Spotify's sign-in */
export function markSpotifyAttempt() {
  try {
    localStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify({ provider: "spotify", at: Date.now() }));
  } catch {}
}

(() => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const error = params.get("error") || hash.get("error");
    if (!error) return;
    const attempt = JSON.parse(localStorage.getItem(OAUTH_ATTEMPT_KEY) || "null");
    localStorage.removeItem(OAUTH_ATTEMPT_KEY);
    if (attempt?.provider !== "spotify" || Date.now() - attempt.at > 30 * 60_000) return;

    // "access_denied" = they tapped cancel on Spotify's screen; anything else = Spotify wouldn't let them in
    sessionStorage.setItem(SPOTIFY_BLOCKED_KEY, error === "access_denied" ? "cancelled" : "blocked");
    window.history.replaceState(null, "", window.location.pathname);
  } catch {}
})();
