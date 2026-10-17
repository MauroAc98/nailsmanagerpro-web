'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isCancel } from 'axios';
import { proErrorDe } from '@/lib/proApi';
import type { CacheLru } from '@/lib/cacheLru';
import type { ProError } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';
// Efecto de módulo: registra el reset de la agenda (y de las cachés) en el
// store de sesión. Todo dato cacheado pasa por este hook, así que el reset
// siempre está registrado cuando hay algo que limpiar.
import '@/store/useProAgendaStore';

export interface ProRecurso<T> {
  // Lo último conocido para esta clave (caché o respuesta); null si no hay nada.
  data: T | null;
  // true mientras hay un pedido en vuelo (también cuando se muestra lo cacheado).
  cargando: boolean;
  error: ProError | null;
  reintentar: () => void;
}

interface Resuelto<T> {
  clave: string;
  epoch: number;
  data?: T;
  error?: ProError;
}

// Lectura de un recurso del portal con stale-while-revalidate. `clave` DEBE
// empezar con el id del vínculo (`${vinculoId}:...`); null = no pedir nada.
// - Una respuesta solo se aplica si su pedido sigue vigente: no abortado y sin
//   cambio de negocio/cuenta (epochNegocio) mientras volaba.
// - El error de bloqueo de negocio (vinculoDisabled / noService) se vuelca al
//   store de sesión; sessionRevoked lo resuelve el evento global.
export function useProRecurso<T>(
  clave: string | null,
  cargar: (signal: AbortSignal) => Promise<T>,
  cache: CacheLru<T>,
): ProRecurso<T> {
  const epoch = useProAuthStore((s) => s.epochNegocio);
  const [resuelto, setResuelto] = useState<Resuelto<T> | null>(null);
  const [intento, setIntento] = useState(0);
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    if (clave === null) return;
    const controller = new AbortController();
    const vinculoId = useProAuthStore.getState().vinculoActivoId;
    const vigente = () => !controller.signal.aborted && useProAuthStore.getState().epochNegocio === epoch;

    cargarRef
      .current(controller.signal)
      .then((data) => {
        if (!vigente()) return;
        cache.set(clave, data);
        setResuelto({ clave, epoch, data });
      })
      .catch((err: unknown) => {
        // Cancelación primero: no es un error del portal.
        if (isCancel(err) || !vigente()) return;
        const error = proErrorDe(err);
        if (vinculoId !== null) {
          const { marcarBloqueo } = useProAuthStore.getState();
          if (error.kind === 'vinculoDisabled') marcarBloqueo(vinculoId, 'disabled');
          else if (error.kind === 'noService') marcarBloqueo(vinculoId, 'noService', error.motivo);
        }
        setResuelto({ clave, epoch, error });
      });

    return () => controller.abort();
  }, [clave, epoch, intento, cache]);

  const reintentar = useCallback(() => {
    setResuelto(null);
    setIntento((n) => n + 1);
  }, []);

  if (clave === null) return { data: null, cargando: false, error: null, reintentar };
  const propio = resuelto?.clave === clave && resuelto.epoch === epoch ? resuelto : null;
  return {
    data: propio?.data ?? cache.get(clave) ?? null,
    cargando: propio === null,
    error: propio?.error ?? null,
    reintentar,
  };
}
