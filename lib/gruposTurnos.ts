import type { Turno } from '@/services/turnoService';

// Turnos de un mismo grupo (una promo o varios servicios con profesionales
// distintas): helpers puros de la agenda. El `modo` del grupo es interno y nunca
// se muestra. La tarjeta de la visita se arma en visitasAgenda.ts.

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
