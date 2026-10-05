import type { Turno } from '@/services/turnoService';
import { estimadoAPrecioDeLista, tienePrecioDeListaCompleto, type PreciosDeLista } from '@/lib/pendientesDeCobro';

export type TurnoFiltro = 'todos' | 'confirmado' | 'finalizado';
export type PagoFiltro = 'todos' | 'sena' | 'todo' | 'nada' | 'sinprecio';
export type EstadoPago = Exclude<PagoFiltro, 'todos'>;
export type PeriodoFiltro = 'todo' | 'hoy' | '7dias' | 'mes' | 'proximos';

// Filtros de la pantalla Cobros. Los aplica el backend (GET /cobros): acá solo
// se describen y se mandan.
export interface FiltrosCobros {
  turno: TurnoFiltro;
  pago: PagoFiltro;
  periodo: PeriodoFiltro;
  buscar: string;
}

export interface CobroFila {
  turno: Turno;
  finalizado: boolean;
  pago: EstadoPago;
  // Confirmados: estimado a precio de lista (null si algún servicio no tiene).
  // Finalizados: lo registrado en los servicios (null si falta algún precio).
  precio: number | null;
  // Solo finalizados con todos los precios cargados.
  cobrado: number | null;
  // Seña online PAGADA (estado 'aprobado'), 0 si no hay.
  sena: number;
  reservaId: number | null;
  // Hay más de un turno de la misma reserva: la seña es de la reserva, no de
  // la fila, así que no se calcula "falta" por fila.
  senaCompartida: boolean;
  faltaFila: number | null;
}

const PAGOS_VALIDOS: PagoFiltro[] = ['todos', 'sena', 'todo', 'nada', 'sinprecio'];

export function parsePagoFiltro(valor: string | null | undefined): PagoFiltro {
  return PAGOS_VALIDOS.includes(valor as PagoFiltro) ? (valor as PagoFiltro) : 'todos';
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// El día de hoy según el reloj de quien usa la app (el servidor no decide qué
// es "hoy": su zona horaria no es la del salón).
export function hoyLocal(hoy: Date = new Date()): string {
  return ymd(hoy);
}

// Ventana que se pide: 90 días atrás (la misma que usaba "cobros por
// registrar") y 60 adelante para ver confirmados con seña.
export function rangoDeCobros(hoy: Date = new Date()): { desde: string; hasta: string } {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 90);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 60);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}

// Regla de los "pills" de pago. Es la misma que aplica el backend a la lista
// (App\Services\Cobros\CobrosCalculator): si cambia una, cambia la otra.
//  - Finalizado (estado 'completado'):
//      * algún servicio sin precio registrado  -> 'sinprecio' (falta cargar el precio)
//      * todos registrados y total > 0         -> 'todo'      (pagó todo)
//      * todos registrados y total = 0         -> 'nada'      (sin pago)
//  - Confirmado (aún no hay precio registrado, se usa el de lista):
//      * sin seña aprobada                     -> 'nada'      (sin pago)
//      * seña aprobada >= precio de lista > 0  -> 'todo'      (la seña cubre todo)
//      * seña aprobada menor                   -> 'sena'      (solo seña)
//  Solo la seña con estado 'aprobado' cuenta; pendiente/rechazado/expirado se
//  tratan como sin seña. Un backend viejo (sin `sena`) equivale a sin seña.
//  Los cancelados no se listan.
function derivarFila(turno: Turno, referencias: PreciosDeLista): CobroFila {
  const finalizado = turno.estado === 'completado';
  const senaPagada = turno.sena?.estado === 'aprobado' ? turno.sena.monto : 0;
  const reservaId = turno.sena?.reserva_web_id ?? null;
  const base = { turno, finalizado, sena: senaPagada, reservaId, senaCompartida: false };

  if (finalizado) {
    const conPrecios = turno.servicios.every(s => s.pivot?.precio != null);
    if (turno.servicios.length > 0 && !conPrecios) {
      return { ...base, pago: 'sinprecio', precio: null, cobrado: null, faltaFila: null };
    }
    const cobrado = turno.servicios.reduce((acc, s) => acc + Number(s.pivot?.precio ?? 0), 0);
    return { ...base, pago: cobrado > 0 ? 'todo' : 'nada', precio: cobrado, cobrado, faltaFila: null };
  }

  const precio = tienePrecioDeListaCompleto(turno, referencias) ? estimadoAPrecioDeLista(turno, referencias) : null;
  let pago: EstadoPago = 'nada';
  if (senaPagada > 0) pago = precio != null && precio > 0 && senaPagada >= precio ? 'todo' : 'sena';
  return {
    ...base,
    pago,
    precio,
    cobrado: null,
    faltaFila: precio != null ? Math.max(0, precio - senaPagada) : null,
  };
}

// Fila de pago de UN turno (pantalla de detalle). Devuelve null si no hay nada
// que mostrar: cancelado, o confirmado sin seña y sin precio de lista. La seña
// es de la reserva: si el turno pertenece a un grupo con más de un tramo vivo,
// se marca compartida y no se calcula "falta" por turno (igual que en Cobros).
export function filaDePago(turno: Turno, referencias: PreciosDeLista): CobroFila | null {
  if (turno.estado === 'cancelado') return null;
  const fila = derivarFila(turno, referencias);
  if (!fila.finalizado && fila.precio == null && fila.sena === 0) return null;
  const vivos = turno.grupo?.tramos.filter(t => t.estado !== 'cancelado').length ?? 0;
  if (fila.reservaId != null && vivos > 1) return { ...fila, senaCompartida: true, faltaFila: null };
  return fila;
}
