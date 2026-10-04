// Worker personalizado de next-pwa (customWorkerDir por defecto = "worker"):
// se empaqueta a public/worker-<id>.js y el sw.js generado lo importa con
// importScripts. Solo maneja notificaciones; el caching sigue en runtimeCaching.
import { parsearPayloadPush, urlMismoOrigen } from './pushHelpers';

const ICONO = '/icon-192.png';

self.addEventListener('push', (event) => {
  const p = parsearPayloadPush(event.data);
  const opciones = {
    body: p.body,
    icon: ICONO,
    // No hay ícono monocromo en public/: se reusa el de la app.
    badge: ICONO,
    data: { url: p.url },
    renotify: Boolean(p.tag),
  };
  if (p.tag) opciones.tag = p.tag;
  if (p.timestamp) opciones.timestamp = p.timestamp;
  // Siempre se muestra algo: iOS revoca la suscripción si un push no muestra notificación.
  event.waitUntil(self.registration.showNotification(p.title, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = urlMismoOrigen(
    event.notification.data && event.notification.data.url,
    self.location.origin,
  );

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((c) => c.url.startsWith(self.location.origin));
      if (abierta) {
        const enfocada = 'focus' in abierta ? abierta.focus() : Promise.resolve(abierta);
        return Promise.resolve(enfocada).then((c) => {
          const cliente = c || abierta;
          return 'navigate' in cliente ? cliente.navigate(destino) : self.clients.openWindow(destino);
        });
      }
      return self.clients.openWindow(destino);
    }).catch(() => self.clients.openWindow(destino)),
  );
});
