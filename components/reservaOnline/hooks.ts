'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import type { HoldFlujo } from '@/lib/reservaOnline/types';
import { pasoMinimo, type Paso } from '@/lib/reservaOnline/pasoMinimo';
import { rutaExterna, rutaPaso } from '@/lib/reservaOnline/rutas';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';

// Navegacion inyectable: las pantallas no dependen de next/navigation, asi se
// testean sin mockear el router. Las paginas la conectan con useRouter().push.
export type Ir = (ruta: string) => void;

// Conecta la navegacion inyectable con el router de Next (uso en las paginas).
// `rutaExterna` saca el prefijo /reservar en reservar.turnetto.com antes de
// empujar — ver su comentario en lib/reservaOnline/rutas.ts (bug real: sin
// esto, cada "Continuar" duplicaba el prefijo y daba 404).
export function useIr(): Ir {
  const router = useRouter();
  return useCallback(
    (ruta: string) => {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      router.push(rutaExterna(ruta, hostname));
    },
    [router],
  );
}

const ORDEN: Paso[] = ['servicios', 'horario', 'datos', 'resumen'];

// Guard de paso (decision D6): activa el slug, y si el estado guardado no
// alcanza para este paso redirige al primer paso incompleto. Devuelve `listo`
// recien cuando el paso puede renderizarse (evita parpadeo y mismatch de
// hidratacion: en el servidor el store esta vacio).
export function useGuardaPaso(slug: string, paso: Paso, ir: Ir): boolean {
  const irRef = useRef(ir);
  useEffect(() => {
    irRef.current = ir;
  });
  useEffect(() => {
    const store = useReservaOnlineStore.getState();
    if (store.slug !== slug) store.activarSlug(slug);
    const minimo = pasoMinimo(useReservaOnlineStore.getState());
    if (ORDEN.indexOf(minimo) < ORDEN.indexOf(paso)) irRef.current(rutaPaso(slug, minimo));
  }, [slug, paso]);
  // Derivado del store (sin setState en el efecto): en el servidor y en la
  // primera pasada del cliente el slug aun no esta activo, asi que no hay mismatch.
  return useReservaOnlineStore(
    (s) => s.slug === slug && ORDEN.indexOf(pasoMinimo(s)) >= ORDEN.indexOf(paso),
  );
}

// Carga asincrona con estados explicitos. `clave` cambia => vuelve a pedir.
export function useCarga<T>(
  cargar: () => Promise<T>,
  clave: string,
): { data: T | null; error: ReservaOnlineError | null; cargando: boolean; reintentar: () => void } {
  const [estado, setEstado] = useState<{ clave: string; data: T | null; error: ReservaOnlineError | null }>({
    clave: '',
    data: null,
    error: null,
  });
  const [intento, setIntento] = useState(0);
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    let vigente = true;
    cargarRef
      .current()
      .then((data) => vigente && setEstado({ clave, data, error: null }))
      .catch((e: unknown) => {
        if (!vigente) return;
        const error = e instanceof ReservaOnlineError ? e : new ReservaOnlineError('unknown');
        setEstado({ clave, data: null, error });
      });
    return () => {
      vigente = false;
    };
  }, [clave, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  const vigenteEstado = estado.clave === clave;
  return {
    data: vigenteEstado ? estado.data : null,
    error: vigenteEstado ? estado.error : null,
    cargando: !vigenteEstado,
    reintentar,
  };
}

// Retencion vigente del flujo con su cuenta regresiva. `vencido` = hubo hold y
// ya paso su vencimiento segun el reloj de la pantalla (el servidor decide en
// ultima instancia: puede responder hold_expired antes).
export function useHold(
  ahora: () => number = Date.now,
  cadaMs = 1000,
): { hold: HoldFlujo | null; restanteMs: number; vencido: boolean } {
  const hold = useReservaOnlineStore((s) => s.hold);
  const reloj = useAhora(ahora, cadaMs);
  const restanteMs = hold ? hold.expiraMs - reloj : 0;
  return { hold, restanteMs, vencido: hold !== null && restanteMs <= 0 };
}

// Reloj para la cuenta regresiva; `ahora` es inyectable (tests con reloj fijo).
export function useAhora(ahora: () => number = Date.now, cadaMs = 1000): number {
  const [valor, setValor] = useState(() => ahora());
  useEffect(() => {
    const id = setInterval(() => setValor(ahora()), cadaMs);
    return () => clearInterval(id);
  }, [ahora, cadaMs]);
  return valor;
}
