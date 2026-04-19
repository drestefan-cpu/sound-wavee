---
name: Always include cleanup SQL with deployment steps
description: After any Apple Music sync change, always include the cleanup SQL alongside deployment instructions
type: feedback
---

After implementing any change to sync-apple-music-likes (or any sync function that modifies what gets imported), always include the cleanup SQL at the end of the response — not as a separate step the user has to ask for.

**Why:** User had to explicitly ask for it after every implementation. It's always needed before a re-sync to avoid stale data interfering with the new logic.

**How to apply:** In the "What to do next" section of any sync function change, always include the cleanup SQL as step 1, before deploy and reconnect steps.
