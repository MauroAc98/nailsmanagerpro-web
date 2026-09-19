import type { BookableService } from './types';

// Suma la duracion de los servicios elegidos. El flujo publico NO calcula
// totales de precio: los precios son "desde" (referencia) y el unico monto
// firme es la sena. Ids desconocidos o repetidos no suman (la seleccion es un
// conjunto).
export function duracionDeServicios(servicios: BookableService[], ids: number[]): number {
  const elegidos = new Set(ids);
  return servicios.reduce((acc, s) => (elegidos.has(s.id) ? acc + s.duracionMinutos : acc), 0);
}

// "45 min", "2 h", "2 h 30 min". Las unidades son iguales en es y pt-BR.
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
