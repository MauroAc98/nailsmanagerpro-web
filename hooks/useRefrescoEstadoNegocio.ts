'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

// Cada cuánto como mínimo se vuelve a preguntar al backend (evita ráfagas si
// el foco y la visibilidad cambian a la vez) y cada cuánto se pregunta sola
// mientras la app está abierta y a la vista.
const MIN_ENTRE_REFRESCOS_MS = 15_000;
const INTERVALO_MS = 60_000;

// El admin puede activar o desactivar la reserva online (u otros datos del
// negocio) desde otro navegador mientras esta app sigue abierta. Sin esto el
// cambio solo se veía al cerrar sesión y volver a entrar. Refresca al volver a
// la pestaña o recuperar el foco, y cada minuto mientras se la mira.
export function useRefrescoEstadoNegocio(): void {
  const activo = useAuthStore((s) => s.authStatus === 'authenticated' && !!s.user);

  useEffect(() => {
    if (!activo) return;
    // Recién se cargó el usuario (login o arranque): ese es el último dato fresco.
    let ultimo = Date.now();

    const refrescar = () => {
      if (document.visibilityState !== 'visible') return;
      const ahora = Date.now();
      if (ahora - ultimo < MIN_ENTRE_REFRESCOS_MS) return;
      ultimo = ahora;
      void useAuthStore.getState().refrescarEstadoNegocio();
    };

    document.addEventListener('visibilitychange', refrescar);
    window.addEventListener('focus', refrescar);
    const intervalo = setInterval(refrescar, INTERVALO_MS);

    return () => {
      document.removeEventListener('visibilitychange', refrescar);
      window.removeEventListener('focus', refrescar);
      clearInterval(intervalo);
    };
  }, [activo]);
}
