import type { Profesional } from '@/services/profesionalService';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import { tStatic } from '@/store/useLocaleStore';
import { nombreDia } from '@/lib/dateFormat';

// ─────────────────────────────────────────────
// Aviso NO bloqueante (a diferencia de validarTurno) para la agenda propia:
// un día no laborable o una fecha bloqueada no impiden agendar — el dueño
// puede confirmar igual (ej. la cliente viene en el franco de la
// profesional). La reserva PÚBLICA, en cambio, nunca ofrece estos
// horarios — ese filtro es un HARD block del lado del backend
// (DisponibilidadService), sin equivalente acá. Ver design.md > Data Flow.
// ─────────────────────────────────────────────

interface AdvertenciaTurnoParams {
  fecha: string;                  // "YYYY-MM-DD"
  hora: string;                   // "HH:MM"
  duracionMinutos: number;
  // `null` = sin profesional específica resuelta (cuenta sin profesionales
  // activas) — solo se evalúan los bloqueos salon-wide en ese caso.
  profesional: Profesional | null;
  bloqueos: BloqueoAgenda[];
}

function toMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function advertenciaTurno({
  fecha,
  hora,
  duracionMinutos,
  profesional,
  bloqueos,
}: AdvertenciaTurnoParams): string | null {
  // ── Día de la semana no laborable ──────────────────────────
  // Misma convención que el backend (Carbon/Date#getDay(): 0=domingo..6=sábado).
  if (profesional && profesional.dias_atencion !== null) {
    const diaSemana = new Date(`${fecha}T00:00:00`).getDay();
    if (!profesional.dias_atencion.includes(diaSemana)) {
      return tStatic('validation.TurnoAdvertencias.diaNoLaborable', {
        diaSemana: nombreDia(new Date(`${fecha}T00:00:00`), 'long', 'ninguna'),
        profesional: profesional.nombre,
      });
    }
  }

  // ── Bloqueos de esa fecha que aplican: salon-wide (profesional_id null)
  // siempre, más los específicos de la profesional elegida. ──────────
  const bloqueosQueAplican = bloqueos.filter(b =>
    b.fecha === fecha && (b.profesional_id === null || b.profesional_id === profesional?.id)
  );

  const inicioNuevo = toMinutos(hora);
  const finNuevo = inicioNuevo + duracionMinutos;

  for (const b of bloqueosQueAplican) {
    // Día completo: ambos horarios ausentes.
    const esDiaCompleto = b.hora_desde === null && b.hora_hasta === null;
    const haySolapeParcial = !esDiaCompleto
      && toMinutos(b.hora_desde!) < finNuevo
      && toMinutos(b.hora_hasta!) > inicioNuevo;

    if (esDiaCompleto || haySolapeParcial) {
      return b.motivo
        ? tStatic('validation.TurnoAdvertencias.fechaBloqueadaConMotivo', { motivo: b.motivo })
        : tStatic('validation.TurnoAdvertencias.fechaBloqueadaSinMotivo');
    }
  }

  return null;
}
