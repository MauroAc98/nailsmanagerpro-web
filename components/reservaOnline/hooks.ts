'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { pasoMinimo, type Paso } from '@/lib/reservaOnline/pasoMinimo';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';

// Navegacion inyectable: las pantallas no dependen de next/navigation, asi se
// testean sin mockear el router. Las paginas la conectan con useRouter().push.
export type Ir = (ruta: string) => void;

const ORDEN: Paso[] = ['servicios', 'horario', 'datos', 'resumen'];

// Guard de paso (decision D6): activa el slug, y si el estado guardado no
// alcanza para este paso redirige al primer paso incompleto. Devuelve `listo`
// recien cuando el paso puede renderizarse (evita parpadeo y mismatch de
// hidratacion: en el servidor el store esta vacio).
export function useGuardaPaso(slug: string, paso: Paso, ir: Ir): boolean {
  const [listo, setListo] = useState(false);
  const irRef = useRef(ir);
  useEffect(() => {
    irRef.current = ir;
  });
  useEffect(() => {
    const store = useReservaOnlineStore.getState();
    if (store.slug !== slug) store.activarSlug(slug);
    const minimo = pasoMinimo(useReservaOnlineStore.getState());
    if (ORDEN.indexOf(minimo) < ORDEN.indexOf(paso)) {
      irRef.current(rutaPaso(slug, minimo));
      return;
    }
    setListo(true);
  }, [slug, paso]);
  return listo;
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

// Reloj para la cuenta regresiva; `ahora` es inyectable (tests con reloj fijo).
export function useAhora(ahora: () => number = Date.now, cadaMs = 1000): number {
  const [valor, setValor] = useState(() => ahora());
  useEffect(() => {
    const id = setInterval(() => setValor(ahora()), cadaMs);
    return () => clearInterval(id);
  }, [ahora, cadaMs]);
  return valor;
}
