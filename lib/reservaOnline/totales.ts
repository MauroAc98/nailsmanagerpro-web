import type { BookableService } from './types';

// Suma precio y duracion de los servicios elegidos. Ids desconocidos o
// repetidos no suman (la seleccion es un conjunto).
export function totalesDeServicios(
  servicios: BookableService[],
  ids: number[],
): { precio: number; duracionMinutos: number } {
  const elegidos = new Set(ids);
  return servicios.reduce(
    (acc, s) =>
      elegidos.has(s.id)
        ? { precio: acc.precio + s.precio, duracionMinutos: acc.duracionMinutos + s.duracionMinutos }
        : acc,
    { precio: 0, duracionMinutos: 0 },
  );
}
