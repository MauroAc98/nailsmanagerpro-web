// Worker personalizado de next-pwa (customWorkerDir por defecto = "worker"):
// se empaqueta a public/worker-<id>.js y el sw.js generado lo importa con
// importScripts. Solo maneja notificaciones; el caching sigue en runtimeCaching.
import {
  manejarCambioDeSuscripcion,
  opcionesNotificacion,
  parsearPayloadPush,
  urlMismoOrigen,
} from './pushHelpers';

const ICONO = '/icon-192.png';
const BADGE = '/badge-96.png';

self.addEventListener('push', (event) => {
  const p = parsearPayloadPush(event.data);
  const opciones = opcionesNotificacion(p, ICONO, BADGE);
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

// El navegador rotó la suscripción push: se re-suscribe con la misma clave y se
// avisa a las ventanas abiertas. El SW no habla con el API (no tiene el token):
// la app re-enlaza el endpoint nuevo al abrirse (hooks/useReenlazarPush).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(manejarCambioDeSuscripcion(event.oldSubscription, self.registration, self.clients));
});
