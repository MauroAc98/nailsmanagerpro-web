import type { BookableService } from './types';

// Suma la duracion de los servicios elegidos. El flujo publico NO calcula
// totales de precio: los precios son "desde" (referencia) y el unico monto
// firme es la sena. Ids desconocidos o repetidos no suman (la seleccion es un
// conjunto).
export function duracionDeServicios(servicios: BookableService[], ids: number[]): number {
  const elegidos = new Set(ids);
  return servicios.reduce((acc, s) => (elegidos.has(s.id) ? acc + s.duracionMinutos : acc), 0);
}

// Vive en `lib/duracion.ts` (lo usa también la pantalla de Servicios); se
// re-exporta acá para no tocar los imports del flujo de reserva online.
export { formatearDuracion } from '@/lib/duracion';
