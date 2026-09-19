import type { Fecha } from './types';

// Aritmetica de fechas 'YYYY-MM-DD' en UTC puro: ni la zona del navegador ni
// el DST pueden correr el dia (decision D7).
export function sumarDias(fecha: Fecha, dias: number): Fecha {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Tira de `n` dias consecutivos empezando en `desde` (inclusive).
export function diasDesde(desde: Fecha, n: number): Fecha[] {
  return Array.from({ length: n }, (_, i) => sumarDias(desde, i));
}
