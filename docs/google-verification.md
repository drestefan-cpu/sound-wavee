# Google sign-in: branding, publishing and verification

What to put in each field of Google Cloud Console → **Google Auth Platform**, and how to record the
demo video Google asks for. Everything here matches what PLAI actually does.

## 1. Branding

| Field | Value |
|---|---|
| App name | `PLAI` |
| User support email | andre@delaneyprojects.xyz |
| App logo | `public/brand/plai-logo-120.png` (120×120 PNG) — optional, see note |
| Application home page | `https://plai.delaneyprojects.xyz` |
| Application privacy policy link | `https://plai.delaneyprojects.xyz/privacy` |
| Application terms of service link | `https://plai.delaneyprojects.xyz/terms` |
| Authorised domains | `delaneyprojects.xyz` and `supabase.co` |
| Developer contact email | andre@delaneyprojects.xyz |

**Logo note:** the logo is optional. Uploading one means Google has to approve the branding before
the logo shows (a few working days), so it's fine to leave it out at first and add it later.

**Domain ownership:** Google checks that you own `delaneyprojects.xyz`. If the Branding page says the
domain isn't verified, click the link it shows. It opens Google Search Console, which gives you a TXT
record to add at your domain registrar (where you bought delaneyprojects.xyz). Add it, wait a few
minutes, then click Verify.

## 2. Data access (scopes)

PLAI now asks for **one** YouTube permission, read-only:

- `https://www.googleapis.com/auth/youtube.readonly`

(plus the basic `openid`, `email`, `profile` that come with Google sign-in.)

In **Data Access**, remove `.../auth/youtube` if it's listed, and add `.../auth/youtube.readonly`.

**Why PLAI needs it** (paste into the justification box):

> PLAI is a social music app: friends see the songs each other love across Spotify, Apple Music,
> Tidal and YouTube Music. When a user connects YouTube Music, PLAI uses youtube.readonly to read the
> user's channel name and their "Liked videos" playlist (channels.list, playlistItems.list,
> videos.list), keeps the music among those likes, and shows them as liked songs on the user's PLAI
> profile and in their friends' feeds. PLAI never posts, deletes or changes anything on YouTube.
> Users can disconnect in PLAI Settings or at myaccount.google.com/permissions, and can delete all
> their PLAI data in Settings → delete my account.

## 3. Publish

**Audience → Publishing status: Testing → Publish app → Confirm.**

After publishing, Google sign-ins no longer expire after 7 days. Until verification is finished,
people see "Google hasn't verified this app" and continue with **Advanced → Go to PLAI**. Up to 100
people can sign in that way.

## 4. Verification (removes the "unverified app" screen)

Google asks for the branding above, the scope justification, and a **demo video** uploaded to
YouTube as **Unlisted**, with its link pasted into the verification form.

### Demo video script (about 2 minutes, screen recording)

Record on a computer (QuickTime → File → New Screen Recording) or a phone screen recording. Use
Chrome or Safari at plai.delaneyprojects.xyz. Speaking isn't required; on-screen text or a voice-over
both work. Show each step clearly; don't cut out the Google screens.

1. **What PLAI is (10s).** Open `https://plai.delaneyprojects.xyz`. Pause on the start screen
   with its description and the privacy · terms links at the bottom.
2. **The consent screen (30s).** Tap **continue with YouTube Music**. On Google's screen:
   - pick the Google account,
   - **show the browser address bar**, so the reviewer can see the `client_id=` in the URL (zoom in
     or click into the address bar),
   - pause on the permission screen showing "View your YouTube account", then click **Continue /
     Allow**.
3. **Using the data (40s).** Back in PLAI, go to **Library → collection** and show the liked
   YouTube Music songs appearing. Open one song to show it's displayed as a song (title, artist,
   artwork) with "play on youtube music".
4. **Where friends see it (20s).** Show the Friends feed or your profile with those songs.
5. **Read-only (10s).** Optional on-screen text: "PLAI only reads liked videos; it never posts or
   changes anything on YouTube."
6. **Disconnecting and deleting (20s).** Open **Settings**: show the YouTube Music connection, the
   **privacy · terms** links, and **delete my account** (open it, don't confirm).

Upload to YouTube as **Unlisted**, title "PLAI — Google OAuth demo (youtube.readonly)", and paste the
link into the verification form.

### Other things Google may ask

- **"Is your home page accessible without sign-in?"** Yes: the start screen describes PLAI and links
  to the privacy policy.
- **"Does the app use Limited Use data for ads or AI?"** No. The privacy policy states PLAI follows
  the Google API Services User Data Policy, including Limited Use.
- Replies come by email to the developer contact address; answer them in the same thread.
