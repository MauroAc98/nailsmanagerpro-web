import { formatoYMD } from '@/lib/dateFormat';

export function variacionPorcentual(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

export function ticketPromedio(ganancias: number, turnos: number): number | null {
  if (turnos <= 0) return null;
  return Math.round(ganancias / turnos);
}

// Mes calendario anterior al de `viewDate`, en componentes locales (nunca
// toISOString: corre un día en husos negativos — ver formatoYMD).
export function rangoMesAnterior(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
  return { desde: formatoYMD(desde), hasta: formatoYMD(hasta) };
}
