// Suma corrida de los montos diarios. Los días futuros (null) quedan null: la
// curva se corta en hoy en vez de aplanarse.
export function acumular(montos: (number | null)[]): (number | null)[] {
  let total = 0;
  return montos.map(m => {
    if (m === null) return null;
    total += m;
    return total;
  });
}

// Acumulado del mes anterior alineado POR POSICIÓN (día 1 con día 1) al largo
// del mes actual: recortado si el previo es más largo, undefined donde el
// previo no tiene ese día.
export function alinearPrevio(montosPrevio: number[], largo: number): (number | undefined)[] {
  const acum = acumular(montosPrevio) as number[];
  return Array.from({ length: largo }, (_, i) => acum[i]);
}

// Diferencia del acumulado actual contra el previo A IGUAL DÍA: el último día
// con dato del mes actual (hoy, o el último del mes si ya cerró). Si el previo
// es más corto que ese día, se usa su último día disponible. Null sin base de
// comparación (previo en 0) o sin ningún dato actual.
export function diferenciaAcumulada(
  actual: (number | null)[], previo: (number | undefined)[],
): { dia: number; diff: number } | null {
  let idx = -1;
  for (let i = actual.length - 1; i >= 0; i--) {
    if (actual[i] !== null) { idx = i; break; }
  }
  if (idx < 0) return null;

  let base: number | undefined;
  for (let i = Math.min(idx, previo.length - 1); i >= 0; i--) {
    if (previo[i] !== undefined) { base = previo[i]; break; }
  }
  if (base === undefined || base <= 0) return null;
  return { dia: idx + 1, diff: (actual[idx] as number) - base };
}

// Promedio por día de los días ya transcurridos (ignora los null futuros; los
// días con $0 cuentan: son días reales sin cobros).
export function promedioDiario(montos: (number | null)[]): number | null {
  const reales = montos.filter((m): m is number => m !== null);
  if (reales.length === 0) return null;
  return reales.reduce((a, b) => a + b, 0) / reales.length;
}
