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

// Para el mes en curso: comparar los días transcurridos contra el MISMO tramo
// del mes anterior (día 1 al día de hoy, recortado si el mes anterior es más
// corto) — contra el mes anterior entero un mes a medio andar siempre parece
// un derrumbe. Null si `viewDate` no es el mes en curso (meses cerrados o
// futuros se comparan completos).
export function rangoMesAnteriorMismoPeriodo(
  viewDate: Date, hoy: Date,
): { desde: string; hasta: string; dia: number } | null {
  if (viewDate.getFullYear() !== hoy.getFullYear() || viewDate.getMonth() !== hoy.getMonth()) return null;
  const ultimoDiaPrevio = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
  const dia = Math.min(hoy.getDate(), ultimoDiaPrevio);
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() - 1, dia);
  return { desde: formatoYMD(desde), hasta: formatoYMD(hasta), dia };
}

export interface ServicioUnido {
  servicio_id: number;
  nombre: string;
  turnos: number;
  monto: number;
  // monto ÷ turnos. Null cuando no hay plata cobrada o turnos que lo respalden.
  ticket: number | null;
}

// Une servicios_mas_pedidos (cantidad = turnos confirmados + completados) con
// ganancias_por_servicio (monto = solo completados) por servicio_id. Ojo: el
// ticket mezcla ambas poblaciones, así que subestima un poco mientras haya
// turnos confirmados sin cobrar (mes en curso).
export function unirServicios(
  masPedidos: { servicio_id: number; nombre: string; cantidad: number }[],
  ganancias: { servicio_id: number; nombre: string; monto: number }[],
): ServicioUnido[] {
  const mapa = new Map<number, ServicioUnido>();
  for (const s of masPedidos) {
    mapa.set(s.servicio_id, { servicio_id: s.servicio_id, nombre: s.nombre, turnos: s.cantidad, monto: 0, ticket: null });
  }
  for (const g of ganancias) {
    const previo = mapa.get(g.servicio_id);
    mapa.set(g.servicio_id, { servicio_id: g.servicio_id, nombre: previo?.nombre ?? g.nombre, turnos: previo?.turnos ?? 0, monto: g.monto, ticket: null });
  }
  return [...mapa.values()]
    .map(s => ({ ...s, ticket: s.monto > 0 && s.turnos > 0 ? s.monto / s.turnos : null }))
    .sort((a, b) => b.monto - a.monto);
}

// Burbujas: top 6 por plata, y solo si hay al menos 3 servicios con plata
// cobrada (con menos, un gráfico de dispersión no dice nada).
export function serviciosParaBurbujas(servicios: ServicioUnido[]): ServicioUnido[] {
  const conPlata = servicios.filter(s => s.monto > 0 && s.ticket !== null).sort((a, b) => b.monto - a.monto);
  return conPlata.length >= 3 ? conPlata.slice(0, 6) : [];
}

// Ticket de un día de la semana (ISO 1..7): lo cobrado en las fechas de ese
// día ÷ turnos completados de ese día, ambos del mismo período. Null si no hay
// completados (no hay de dónde derivarlo).
export function ticketDiaSemana(
  gananciasPorDia: { fecha: string; monto: number }[],
  ritmo: { dia_semana: number; completados: number }[],
  iso: number,
): number | null {
  const completados = ritmo.find(d => d.dia_semana === iso)?.completados ?? 0;
  if (completados <= 0) return null;
  const monto = gananciasPorDia
    .filter(g => {
      const d = new Date(`${g.fecha}T00:00:00`).getDay();
      return (d === 0 ? 7 : d) === iso;
    })
    .reduce((a, g) => a + g.monto, 0);
  return monto > 0 ? Math.round(monto / completados) : null;
}

// Hora con más turnos dentro de UN día de la semana (ISO 1..7).
export function horaPicoDelDia(
  ocupacion: { dia_semana: number; hora: number; cantidad: number }[], iso: number,
): number | null {
  const delDia = ocupacion.filter(b => b.dia_semana === iso && b.cantidad > 0);
  if (delDia.length === 0) return null;
  return delDia.reduce((best, b) => (b.cantidad > best.cantidad ? b : best), delDia[0]).hora;
}
