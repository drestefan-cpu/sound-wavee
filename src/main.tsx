import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
