import type { Fecha } from './types';

const MS_DIA = 86_400_000;

const aUtc = (f: Fecha): number => {
  const [a, m, d] = f.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};

// Dias de calendario entre dos fechas (siempre >= 0).
export function diasEntre(a: Fecha, b: Fecha): number {
  return Math.round(Math.abs(aUtc(b) - aUtc(a)) / MS_DIA);
}

// Entre los dias con lugar, el mas cercano ANTES y el mas cercano DESPUES de
// `fecha`, siempre dentro de la ventana reservable: nunca un dia pasado ni mas
// alla del limite.
export function diasCercanos(
  conLugar: Fecha[],
  fecha: Fecha,
  ventana: { primero: Fecha; ultimo: Fecha },
): { antes: Fecha | null; despues: Fecha | null } {
  let antes: Fecha | null = null;
  let despues: Fecha | null = null;
  for (const f of conLugar) {
    if (f < ventana.primero || f > ventana.ultimo || f === fecha) continue;
    if (f < fecha) {
      if (antes === null || f > antes) antes = f;
    } else if (despues === null || f < despues) {
      despues = f;
    }
  }
  return { antes, despues };
}
