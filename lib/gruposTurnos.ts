import type { Turno } from '@/services/turnoService';

// Turnos de un mismo grupo (una promo o varios servicios con profesionales
// distintas): helpers puros para la tarjeta de la agenda. El `modo` del
// grupo es interno y nunca se muestra.

// Minutos de pared de "YYYY-MM-DD HH:MM:SS" / ISO sin zona (sin Date local: sin saltos de DST).
const aMinutos = (fechaHora: string): number => Date.parse(`${fechaHora.replace(' ', 'T').slice(0, 19)}Z`) / 60_000;

// Nombres de las OTRAS profesionales del grupo (sin la del propio turno, sin tramos cancelados, sin repetir).
export function nombresDeLosOtros(turno: Turno): string[] {
  if (turno.grupo_id == null || !turno.grupo) return [];
  const nombres = turno.grupo.tramos
    .filter((t) => t.estado !== 'cancelado' && t.profesional_id !== turno.profesional_id)
    .map((t) => t.profesional_nombre)
    .filter((n): n is string => !!n);
  return [...new Set(nombres)];
}

export interface BarraGrupo {
  arriba: boolean;
  abajo: boolean;
}

// Barra vertical entre tarjetas CONSECUTIVAS de la lista que son del mismo
// grupo y se tocan en el tiempo (el siguiente empieza antes de que termine el
// anterior, o justo cuando termina). Con otro turno entre medio, o con un
// hueco de tiempo, no hay barra. Solo trae entradas para los turnos con barra.
export function barrasDeGrupo(turnos: Turno[]): Map<number, BarraGrupo> {
  const barras = new Map<number, BarraGrupo>();
  for (let i = 0; i + 1 < turnos.length; i++) {
    const a = turnos[i];
    const b = turnos[i + 1];
    if (a.grupo_id == null || a.grupo_id !== b.grupo_id) continue;
    const finA = aMinutos(a.fecha_hora) + a.duracion_total_minutos;
    if (aMinutos(b.fecha_hora) > finA) continue;
    barras.set(a.id, { arriba: barras.get(a.id)?.arriba ?? false, abajo: true });
    barras.set(b.id, { arriba: true, abajo: false });
  }
  return barras;
}

const horaDe = (fechaHora: string): string => fechaHora.replace(' ', 'T').slice(11, 16);
type Tramo = NonNullable<Turno['grupo']>['tramos'][number];
const propio = (turno: Turno): Tramo | undefined => turno.grupo?.tramos.find((t) => t.turno_id === turno.id);

// "Softgel · con Ana": el turno nombrado por su servicio y su propia profesional (solo si es de un grupo).
export function etiquetaTramo(turno: Turno): string {
  const servicios = turno.servicios.filter((s) => s != null).map((s) => s.nombre).join(' + ');
  const nombre = propio(turno)?.profesional_nombre;
  return nombre ? `${servicios} · con ${nombre}` : servicios;
}

// Tramos del grupo que "cancelar todo el combo" realmente cancela: los que no estan cancelados ni completados.
export const tramosPendientes = (turno: Turno): Tramo[] =>
  (turno.grupo?.tramos ?? []).filter((t) => t.estado !== 'cancelado' && t.estado !== 'completado');

export interface ResumenMovimiento {
  movido: { nombre: string; hora: string };
  quedan: { nombre: string; hora: string }[];
}

// Editar la hora de un turno de un grupo mueve SOLO ese turno: avisa cual se mueve y a que hora siguen los otros.
export function resumenMovimiento(turno: Turno, nuevaFechaHora: string): ResumenMovimiento | null {
  const yo = propio(turno);
  const quedan = (turno.grupo?.tramos ?? []).filter((t) => t.turno_id !== turno.id && t.estado === 'confirmado');
  if (!yo || quedan.length === 0) return null;
  if (turno.fecha_hora.replace(' ', 'T').slice(0, 16) === nuevaFechaHora.replace(' ', 'T').slice(0, 16)) return null;
  return {
    movido: { nombre: yo.profesional_nombre ?? '', hora: horaDe(nuevaFechaHora) },
    quedan: quedan.map((t) => ({ nombre: t.profesional_nombre ?? '', hora: horaDe(t.fecha_hora) })),
  };
}
