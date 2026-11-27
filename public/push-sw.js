// Push notifications for PLAI (loaded into the app's service worker).
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) {
    msg = { title: "PLAI", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "PLAI", {
      body: msg.body || "",
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: msg.url || "/notifications" },
    }),
  );
});

// Tap a notification → open PLAI on the right page (reuse an open window if there is one)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          return w.focus().then((f) => (f && "navigate" in f ? f.navigate(url) : null));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
