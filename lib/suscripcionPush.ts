import type { SuscripcionPush } from '@/services/pushService';

const LIMITE_LECTURA_MS = 1000;

// Lee la suscripción push que el navegador YA tiene, sin crear ninguna ni pedir
// permiso. Usa getRegistration() y no `serviceWorker.ready`: `ready` puede no
// resolver nunca (SW sin registrar) y acá no se puede esperar sin cota. Nunca
// lanza: ante cualquier problema o demora devuelve null.
export async function leerSuscripcionExistente(limiteMs: number = LIMITE_LECTURA_MS): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lectura = (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? await reg.pushManager.getSubscription() : null;
    })();
    const limite = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), limiteMs);
    });
    return await Promise.race([lectura, limite]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Cuerpo de POST /push/subscriptions (el mismo que arma el toggle de avisos).
export function payloadDeSuscripcion(sub: PushSubscription): SuscripcionPush {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    content_encoding:
      typeof PushManager !== 'undefined' && PushManager.supportedContentEncodings?.includes('aes128gcm')
        ? 'aes128gcm'
        : undefined,
    user_agent: navigator.userAgent.slice(0, 255),
  };
}
