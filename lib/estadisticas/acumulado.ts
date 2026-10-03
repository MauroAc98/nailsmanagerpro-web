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
// con dato del mes actual (hoy, o el último del mes si ya cerró), recortado al
// último día que también tiene el mes previo. Null sin base de comparación
// (previo en 0) o sin ningún dato actual.
export function diferenciaAcumulada(
  actual: (number | null)[], previo: (number | undefined)[],
): { dia: number; diff: number } | null {
  let idx = -1;
  for (let i = actual.length - 1; i >= 0; i--) {
    if (actual[i] !== null) { idx = i; break; }
  }
  if (idx < 0) return null;

  // Último día en común: si el previo no tiene el día idx (mes más corto), se
  // retrocede hasta el último que sí tiene y se compara AMBOS a ese día.
  let comun = -1;
  for (let i = Math.min(idx, previo.length - 1); i >= 0; i--) {
    if (previo[i] !== undefined) { comun = i; break; }
  }
  if (comun < 0) return null;
  const base = previo[comun] as number;
  if (base <= 0) return null;
  return { dia: comun + 1, diff: (actual[comun] as number) - base };
}

// Promedio por día de los días ya transcurridos (ignora los null futuros; los
// días con $0 cuentan: son días reales sin cobros).
export function promedioDiario(montos: (number | null)[]): number | null {
  const reales = montos.filter((m): m is number => m !== null);
  if (reales.length === 0) return null;
  return reales.reduce((a, b) => a + b, 0) / reales.length;
}
