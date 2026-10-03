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
