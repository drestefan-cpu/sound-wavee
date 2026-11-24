// PLAI's own Spotify app token (client-credentials flow) — used for catalogue lookups,
// never a user's token. See links.ts for cross-platform link resolution.

export async function getSpotifyAppToken(): Promise<string | null> {
  try {
    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")
    if (!clientId || !clientSecret) return null
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    })
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

