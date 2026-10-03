import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import type { Turno } from '@/services/turnoService';
import { advertenciaTurno } from '@/lib/turnoAdvertencias';
import { tramosPendientes } from '@/lib/gruposTurnos';

// Alta manual de una promo con componentes ("combo") desde la agenda. El modo
// de la promo es interno: aca solo se derivan los horarios que se van a
// agendar para mostrarlos como una lista de "servicio · con profesional".

export interface TramoCombo {
  servicio: string;
  profesionalId: number;
  profesional: string;
  inicio: string; // 'HH:MM'
  fin: string;    // 'HH:MM'
  duracion: number;
}

const aMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const aHhmm = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Cada componente (en el orden de la promo) con su horario: todos arrancan a
// la vez si la promo atiende en paralelo, uno detras de otro si no.
export function tramosDelCombo(detalle: Servicio, horaInicio: string): TramoCombo[] {
  const paralelo = detalle.modo_promo === 'paralelo';
  const base = aMinutos(horaInicio);
  let offset = 0;
  return [...(detalle.componentes ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const inicio = base + (paralelo ? 0 : offset);
      offset += c.duracion_minutos;
      return {
        servicio: c.nombre,
        profesionalId: c.profesional_id,
        profesional: c.profesional_nombre,
        inicio: aHhmm(inicio),
        fin: aHhmm(inicio + c.duracion_minutos),
        duracion: c.duracion_minutos,
      };
    });
}

// Los turnos de un combo que se van a mover (los pendientes), con su horario
// nuevo: la primera (menor id) arranca en `nuevaHora` y las demas conservan su
// desfasaje respecto de ella.
export function tramosAMover(turno: Turno, nuevaHora: string): TramoCombo[] {
  const pendientes = [...tramosPendientes(turno)].sort((a, b) => a.turno_id - b.turno_id);
  if (pendientes.length === 0) return [];
  const hhmmDe = (f: string) => f.replace(' ', 'T').slice(11, 16);
  const ancla = aMinutos(hhmmDe(pendientes[0].fecha_hora));
  return pendientes.map((p) => {
    const inicio = aMinutos(nuevaHora) + aMinutos(hhmmDe(p.fecha_hora)) - ancla;
    return {
      servicio: '',
      profesionalId: p.profesional_id,
      profesional: p.profesional_nombre ?? '',
      inicio: aHhmm(inicio),
      fin: aHhmm(inicio + p.duracion_total_minutos),
      duracion: p.duracion_total_minutos,
    };
  });
}

// El MISMO aviso que el turno comun (dia no laborable / bloqueo de agenda),
// evaluado para cada tramo con SU profesional. Une los avisos distintos; si el
// aviso no nombra a la profesional, se lo antepone.
export function advertenciaDelCombo(
  tramos: TramoCombo[],
  fecha: string,
  profesionales: Profesional[],
  bloqueos: BloqueoAgenda[],
): string | null {
  const avisos = new Set<string>();
  for (const t of tramos) {
    const profesional = profesionales.find((p) => p.id === t.profesionalId) ?? null;
    const aviso = advertenciaTurno({ fecha, hora: t.inicio, duracionMinutos: t.duracion, profesional, bloqueos });
    if (aviso) avisos.add(aviso.includes(t.profesional) ? aviso : `${t.profesional}: ${aviso}`);
  }
  return avisos.size > 0 ? [...avisos].join('\n\n') : null;
}
