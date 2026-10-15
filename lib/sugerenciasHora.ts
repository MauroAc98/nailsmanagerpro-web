import type { Slot } from '@/services/slotService';

/** Tramo ocupado de un día, en minutos desde las 00:00. */
export interface TramoOcupado {
  inicio: number;
  fin: number;
}

interface SugerirHorasParams {
  slots: Slot[];
  ocupados: TramoOcupado[];
  duracionMinutos: number;
  /** Minutos desde las 00:00 a partir de los cuales se puede sugerir (hoy: la hora actual). */
  desdeMinutos?: number;
  max?: number;
}

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function deMinutos(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export interface OpcionHora {
  hora: string;   // "HH:MM"
  libre: boolean;
}

/** "1 h 30", "45 min", "2 h". */
export function duracionLegible(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/**
 * Todos los inicios posibles del día (los horarios de los slots y el momento en que termina
 * cada turno ya agendado), dentro del rango de atención y desde `desdeMinutos`. `libre` dice
 * si el turno, con su duración, entra sin pisarse con ningún tramo ocupado.
 */
export function opcionesHora({ slots, ocupados, duracionMinutos, desdeMinutos = 0 }: Omit<SugerirHorasParams, 'max'>): OpcionHora[] {
  const activos = slots.filter(s => s.activo).map(s => aMinutos(s.hora)).sort((a, b) => a - b);
  if (activos.length === 0 || duracionMinutos <= 0) return [];
  const horaMin = activos[0];
  const horaMax = activos[activos.length - 1];

  const candidatos = new Set<number>([...activos, ...ocupados.map(o => o.fin)]);
  return [...candidatos]
    .filter(c => c >= horaMin && c <= horaMax && c >= desdeMinutos)
    .sort((a, b) => a - b)
    .map(c => ({
      hora: deMinutos(c),
      libre: !ocupados.some(o => o.inicio < c + duracionMinutos && o.fin > c),
    }));
}

/**
 * Horas de inicio libres para un turno de `duracionMinutos`. Los slots definen el rango de
 * atención (no una lista cerrada): se ofrecen los horarios de los slots y el momento en que
 * termina cada turno ya agendado (para encajar uno a continuación del otro). Un inicio sirve
 * si cae dentro del rango y el turno no se pisa con ningún tramo ocupado.
 */
export function sugerirHoras({ max = 8, ...params }: SugerirHorasParams): string[] {
  return opcionesHora(params).filter(o => o.libre).slice(0, max).map(o => o.hora);
}
