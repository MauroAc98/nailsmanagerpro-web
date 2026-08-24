'use client';

import { useEffect, useState } from 'react';

// Preferencia de "ocultar monto" tipo fintech (ojo/ojo tachado) — persiste
// en localStorage para no tener que re-taparlo cada vez que se abre la app,
// pero es puramente local/de este dispositivo, no pasa por el backend: no
// hace falta sincronizarlo entre sesiones ni justifica una key en un store.
//
// Compartida entre ResumenMesCard (Agenda) y Estadísticas a propósito: el
// motivo real para tapar un monto es privacidad situacional (alguien está
// mirando la pantalla), y ese motivo no cambia según qué pantalla se esté
// viendo — si fueran independientes, taparlo en Agenda y entrar después a
// Estadísticas sin acordarse de taparlo ahí también dejaría el monto
// expuesto justo en el momento que este feature existe para evitar.
const OCULTAR_MONTO_KEY = 'agenda:ocultarMontoResumen';

function leerOcultarMonto(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OCULTAR_MONTO_KEY) === '1';
}

export function useOcultarMonto(): [boolean, (e?: { stopPropagation: () => void }) => void] {
  // Arranca en false (SSR/primer render) y se corrige a la preferencia real
  // en el effect de abajo — leer localStorage directo en el useState
  // desalinearía el HTML del server con el del cliente (hydration mismatch).
  const [ocultarMonto, setOcultarMonto] = useState(false);

  useEffect(() => {
    setOcultarMonto(leerOcultarMonto());
  }, []);

  const toggle = (e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    setOcultarMonto(prev => {
      const next = !prev;
      localStorage.setItem(OCULTAR_MONTO_KEY, next ? '1' : '0');
      return next;
    });
  };

  return [ocultarMonto, toggle];
}
