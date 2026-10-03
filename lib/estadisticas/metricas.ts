import { formatoYMD } from '@/lib/dateFormat';

export function variacionPorcentual(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

export function ticketPromedio(ganancias: number, turnos: number): number | null {
  if (turnos <= 0) return null;
  return Math.round(ganancias / turnos);
}

// Top N por valor + una fila "Otros" con el resto sumado. Si solo sobra UN
// ítem, se muestra con su nombre real: "Otros" de un solo elemento oculta
// información sin ahorrar espacio.
export function topConOtros<T extends { nombre: string; valor: number }>(
  items: T[], n: number, etiquetaOtros: string,
): { nombre: string; valor: number }[] {
  const ordenados = items.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor);
  if (ordenados.length <= n + 1) return ordenados.map(i => ({ nombre: i.nombre, valor: i.valor }));
  const top = ordenados.slice(0, n).map(i => ({ nombre: i.nombre, valor: i.valor }));
  const resto = ordenados.slice(n).reduce((a, i) => a + i.valor, 0);
  return [...top, { nombre: etiquetaOtros, valor: resto }];
}

// Mes calendario anterior al de `viewDate`, en componentes locales (nunca
// toISOString: corre un día en husos negativos — ver formatoYMD).
export function rangoMesAnterior(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
  return { desde: formatoYMD(desde), hasta: formatoYMD(hasta) };
}
