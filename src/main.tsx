import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// When a new service worker takes control, reload once so users
// immediately see the latest version without having to close and reopen.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
