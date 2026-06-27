// Service worker para notificaciones Web Push de VigilAI.
self.addEventListener("push", (event) => {
  let data = { title: "VigilAI", body: "Alerta de seguridad" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VigilAI", {
      body: data.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: "vigilai-alert",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/events"));
});
