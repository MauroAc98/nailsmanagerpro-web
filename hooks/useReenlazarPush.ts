'use client';

import { useEffect, useRef } from 'react';
import { pushService } from '@/services/pushService';
import { useAuthStore } from '@/store/useAuthStore';
import { leerSuscripcionExistente, payloadDeSuscripcion } from '@/lib/suscripcionPush';

// Mensaje que manda el service worker (worker/pushHelpers.ts) cuando el
// navegador rotó la suscripción. No lleva datos: solo avisa que hay que re-enlazar.
const TIPO_SUSCRIPCION_CAMBIO = 'push-subscription-changed';

function hayPermisoYSoporte(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

// Re-enlaza en silencio la suscripción push que el navegador YA tiene con la
// cuenta actual. Cubre dos casos sin que el usuario toque nada:
//   - volver a iniciar sesión tras un logout (que borra el vínculo en el servidor
//     pero conserva permiso y suscripción), y
//   - una rotación de la suscripción por parte del navegador (el SW no puede
//     avisar al servidor porque no tiene el token; lo hace la app al abrirse).
// NUNCA pide permiso ni crea suscripciones: sin permiso concedido o sin
// suscripción existente (toggle apagado a propósito) no hace nada.
// El POST es idempotente por endpoint y el backend lo mueve a quien lo envía.
//
// `habilitado` en false (panel de admin, reserva pública) lo apaga por completo.
export function useReenlazarPush(habilitado = true): void {
  const activo = useAuthStore((s) => habilitado && s.authStatus === 'authenticated' && !!s.user);
  const arrancado = useRef(false);

  useEffect(() => {
    if (!activo) {
      // Sesión cerrada: la próxima que se inicie vuelve a re-enlazar.
      arrancado.current = false;
      return;
    }

    // Idempotente (POST por endpoint): si coinciden dos llamadas no pasa nada.
    const reenlazar = async (): Promise<void> => {
      try {
        if (!hayPermisoYSoporte()) return;
        const sub = await leerSuscripcionExistente();
        // La sesión pudo cerrarse mientras se leía: sin token el POST saldría
        // sin credenciales y el 401 dispararía una revocación espuria.
        if (!sub || useAuthStore.getState().authStatus !== 'authenticated') return;
        await pushService.guardarSuscripcion(payloadDeSuscripcion(sub));
      } catch {
        // Silencioso: se reintenta en el próximo arranque o rotación.
      }
    };

    if (!arrancado.current) {
      arrancado.current = true;
      void reenlazar();
    }

    if (!('serviceWorker' in navigator)) return;
    const onMensaje = (e: MessageEvent) => {
      if (e.data?.type === TIPO_SUSCRIPCION_CAMBIO) void reenlazar();
    };
    const sw = navigator.serviceWorker;
    sw.addEventListener('message', onMensaje);
    return () => sw.removeEventListener('message', onMensaje);
  }, [activo]);
}
