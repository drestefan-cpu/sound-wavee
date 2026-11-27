// (must stay first: reads Spotify sign-in errors before anything else touches the address)
import "./lib/oauthReturn";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PLAI moved from onplai.lovable.app to plai.delaneyprojects.xyz — send old links (and old
// home-screen installs) to the same page on the new address.
const MOVED_FROM = /(^|\.)lovable\.app$/;
const movedAway = MOVED_FROM.test(window.location.hostname);
if (movedAway) {
  window.location.replace(
    `https://plai.delaneyprojects.xyz${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

// When a new service worker takes control, reload once so users
// immediately see the latest version without having to close and reopen.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  // Force an update check whenever the app comes to the foreground.
  // iOS PWA standalone mode does not proactively check for SW updates,
  // so without this the user may run a stale version indefinitely.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }
  });
}

if (!movedAway) createRoot(document.getElementById("root")!).render(<App />);
