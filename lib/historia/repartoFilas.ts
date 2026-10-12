// Reparte las filas de la lista (Semana/Mes) en el alto que realmente le queda
// al cuerpo de la historia, ya descontados encabezado, servicios y pie. Antes
// el espacio entre filas salía del alto útil completo y una quincena de 16
// días se pasaba de largo en celulares chicos.
export const ALTO_FILA = 14;
const ALTO_FILA_MIN = 10;
const GAP_MIN = 2;
const GAP_MAX = 20;

export interface RepartoFilas {
  // null = sin alto medido todavía (primer render, tests): usar el cálculo de siempre.
  gap: number | null;
  altoFila: number;
}

export function repartirFilas(altoDisponible: number, cantidad: number): RepartoFilas {
  if (!(altoDisponible > 0) || cantidad <= 0) return { gap: null, altoFila: ALTO_FILA };
  if (cantidad === 1) return { gap: GAP_MAX, altoFila: ALTO_FILA };
  const espacios = cantidad - 1;
  const gap = (altoDisponible - cantidad * ALTO_FILA) / espacios;
  if (gap >= GAP_MIN) return { gap: Math.min(GAP_MAX, gap), altoFila: ALTO_FILA };
  const altoFila = (altoDisponible - espacios * GAP_MIN) / cantidad;
  return { gap: GAP_MIN, altoFila: Math.max(ALTO_FILA_MIN, altoFila) };
}
