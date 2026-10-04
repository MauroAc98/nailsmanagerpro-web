'use client';

import { useCallback, useEffect, useState } from 'react';
import { pushService } from '@/services/pushService';
import {
  calcularEstadoAvisos,
  errorDeActivacion,
  esIOS,
  urlBase64ToUint8Array,
  type ErrorAvisos,
  type EstadoAvisos,
} from '@/lib/avisosPush';

// null mientras se lee el entorno (en el server no hay navigator).
async function leerEstado(): Promise<EstadoAvisos> {
  const tieneServiceWorker = 'serviceWorker' in navigator;
  const tienePushManager = 'PushManager' in window;
  const tieneNotification = 'Notification' in window;
  const nav = navigator as Navigator & { standalone?: boolean };
  const esStandalone =
    nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

  let suscrito = false;
  if (tieneServiceWorker && tienePushManager && tieneNotification && Notification.permission === 'granted') {
    try {
      // `ready` espera al registro manual de app/providers.tsx. Puede no
      // resolver nunca si el SW no se registró (dev): se acota con timeout.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      suscrito = !!(reg && (await reg.pushManager.getSubscription()));
    } catch {
      suscrito = false;
    }
  }

  return calcularEstadoAvisos({
    tieneServiceWorker,
    tienePushManager,
    tieneNotification,
    esIOS: esIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    esStandalone,
    permiso: tieneNotification ? Notification.permission : 'default',
    suscrito,
  });
}

export function useAvisosReservas() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<ErrorAvisos | null>(null);

  const refrescar = useCallback(async () => setEstado(await leerEstado()), []);

  useEffect(() => {
    let vivo = true;
    leerEstado().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);

  // DEBE llamarse directo desde un click: iOS exige el gesto del usuario
  // para requestPermission().
  const activar = useCallback(async () => {
    setError(null);
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return; // finally refresca: queda 'denied' u 'off'

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const clave = await pushService.getPublicKey();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(clave),
        });
      }
      const json = sub.toJSON();
      try {
        await pushService.guardarSuscripcion({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
          content_encoding: PushManager.supportedContentEncodings?.includes('aes128gcm') ? 'aes128gcm' : undefined,
          user_agent: navigator.userAgent.slice(0, 255),
        });
      } catch (e) {
        // Sin registro en el servidor la suscripción local no sirve: se
        // deshace para no quedar "activo" sin que lleguen avisos.
        await sub.unsubscribe().catch(() => {});
        throw e;
      }
    } catch (e) {
      setError(errorDeActivacion(e));
    } finally {
      setTrabajando(false);
      await refrescar();
    }
  }, [refrescar]);

  const desactivar = useCallback(async () => {
    setError(null);
    setTrabajando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Primero el servidor: si falla se aborta y el estado sigue "activo"
        // (reintentable), en vez de dejar una suscripción huérfana allá.
        await pushService.borrarSuscripcion(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (e) {
      setError(errorDeActivacion(e));
    } finally {
      setTrabajando(false);
      await refrescar();
    }
  }, [refrescar]);

  return { estado, trabajando, error, activar, desactivar };
}
