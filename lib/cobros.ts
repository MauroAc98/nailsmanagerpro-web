import type { Turno } from '@/services/turnoService';
import { estimadoAPrecioDeLista, tienePrecioDeListaCompleto, type PreciosDeLista } from '@/lib/pendientesDeCobro';

export type TurnoFiltro = 'todos' | 'confirmado' | 'finalizado';
export type PagoFiltro = 'todos' | 'sena' | 'todo' | 'nada' | 'sinprecio';
export type EstadoPago = Exclude<PagoFiltro, 'todos'>;

export interface FiltrosCobros {
  turno: TurnoFiltro;
  pago: PagoFiltro;
  q: string;
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
  // Hay más de un turno de la misma reserva en la lista: la seña es de la
  // reserva, no de la fila, así que no se calcula "falta" por fila.
  senaCompartida: boolean;
  faltaFila: number | null;
}

export interface ResumenCobros {
  senaCobrada: number;
  cobradoFinalizados: number;
  faltaCobrar: number;
  sinPrecioCount: number;
  sinPrecioEstimado: number;
}

const PAGOS_VALIDOS: PagoFiltro[] = ['todos', 'sena', 'todo', 'nada', 'sinprecio'];

export function parsePagoFiltro(valor: string | null | undefined): PagoFiltro {
  return PAGOS_VALIDOS.includes(valor as PagoFiltro) ? (valor as PagoFiltro) : 'todos';
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Ventana que se carga: 90 días atrás (la misma que usaba "cobros por
// registrar") y 60 adelante para ver confirmados con seña.
export function rangoDeCobros(hoy: Date = new Date()): { desde: string; hasta: string } {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 90);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 60);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Regla de los "pills" de pago (única fuente de verdad):
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

export function armarFilas(turnos: Turno[], referencias: PreciosDeLista): CobroFila[] {
  const vivos = turnos.filter(t => t.estado !== 'cancelado');
  const porReserva = new Map<number, number>();
  for (const t of vivos) {
    const id = t.sena?.reserva_web_id;
    if (id != null) porReserva.set(id, (porReserva.get(id) ?? 0) + 1);
  }
  return vivos
    .map(t => {
      const fila = derivarFila(t, referencias);
      if (fila.reservaId != null && (porReserva.get(fila.reservaId) ?? 0) > 1) {
        return { ...fila, senaCompartida: true, faltaFila: null };
      }
      return fila;
    })
    .sort((a, b) => b.turno.fecha_hora.localeCompare(a.turno.fecha_hora));
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

export function filtrarFilas(filas: CobroFila[], { turno, pago, q }: FiltrosCobros): CobroFila[] {
  const buscado = normalizar(q.trim());
  return filas.filter(f => {
    if (turno === 'confirmado' && f.finalizado) return false;
    if (turno === 'finalizado' && !f.finalizado) return false;
    if (pago !== 'todos' && f.pago !== pago) return false;
    if (buscado && !normalizar(`${f.turno.cliente.nombre} ${f.turno.cliente.apellido}`).includes(buscado)) return false;
    return true;
  });
}

// Resumen sobre las filas visibles. La seña se suma una vez por reserva
// (los turnos de un grupo repiten la misma). "Falta cobrar" = precio de lista
// de los confirmados menos su seña, por reserva y sin bajar de 0; los
// confirmados sin precio de lista no suman (se desconoce). Los finalizados sin
// precio se cuentan aparte con su estimado a precio de lista.
export function resumir(filas: CobroFila[], referencias: PreciosDeLista): ResumenCobros {
  const senas = new Map<string, number>();
  const faltas = new Map<string, { precio: number; sena: number }>();
  let cobradoFinalizados = 0;
  let sinPrecioCount = 0;
  let sinPrecioEstimado = 0;

  for (const f of filas) {
    const clave = f.reservaId != null ? `r${f.reservaId}` : `t${f.turno.id}`;
    if (f.sena > 0) senas.set(clave, f.sena);
    if (f.finalizado) {
      if (f.pago === 'sinprecio') {
        sinPrecioCount += 1;
        sinPrecioEstimado += estimadoAPrecioDeLista(f.turno, referencias);
      } else {
        cobradoFinalizados += f.cobrado ?? 0;
      }
    } else if (f.precio != null) {
      const acc = faltas.get(clave) ?? { precio: 0, sena: f.sena };
      acc.precio += f.precio;
      faltas.set(clave, acc);
    }
  }

  let senaCobrada = 0;
  for (const m of senas.values()) senaCobrada += m;
  let faltaCobrar = 0;
  for (const { precio, sena } of faltas.values()) faltaCobrar += Math.max(0, precio - sena);

  return { senaCobrada, cobradoFinalizados, faltaCobrar, sinPrecioCount, sinPrecioEstimado };
}
