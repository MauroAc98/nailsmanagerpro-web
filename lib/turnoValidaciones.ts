import { Turno } from '@/services/turnoService';
import { Servicio } from '@/services/servicioService';
import { Slot } from '@/services/slotService';

// ─────────────────────────────────────────────
// Validaciones client-side que espejan las reglas de negocio
// del backend (TurnoController::store/update), para avisarle
// al usuario ANTES de pegarle a la API y recibir un 422.
// ─────────────────────────────────────────────

interface ValidarTurnoParams {
  fecha: string;                    // "YYYY-MM-DD"
  hora: string;                     // "HH:MM"
  clienteId: number;
  servicioIds: number[];
  servicios: Servicio[];            // catálogo completo (duración + nombre)
  turnosDelDia: Turno[];            // turnos ya existentes ese día (todos los clientes)
  slots: Slot[];
  excluirTurnoId?: number;          // al editar: ignorar el propio turno
  aplicarMaxPorCliente?: boolean;   // la API solo aplica este límite al crear, no al editar
}

const MAX_TURNOS_POR_CLIENTE = 2;

function toMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function horaDeFechaHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "YYYY-MM-DD HH:MM:SS" -> "HH:MM"
}

export function validarTurno({
  fecha,
  hora,
  clienteId,
  servicioIds,
  servicios,
  turnosDelDia,
  slots,
  excluirTurnoId,
  aplicarMaxPorCliente = false,
}: ValidarTurnoParams): string | null {
  const candidato = new Date(`${fecha}T${hora}:00`);

  // ── Fecha/hora pasada ─────────────────────────────────────
  if (candidato.getTime() < Date.now()) {
    return 'No se pueden agendar turnos en una fecha u hora que ya pasó.';
  }

  // ── Horario de atención ───────────────────────────────────
  const slotsActivos = slots.filter(s => s.activo).sort((a, b) => a.hora.localeCompare(b.hora));
  if (slotsActivos.length === 0) {
    return 'No tenés horarios de atención configurados. Configurálos en Ajustes.';
  }
  const horaMin = toMinutos(slotsActivos[0].hora);
  const horaMax = toMinutos(slotsActivos[slotsActivos.length - 1].hora);
  const horaTurno = toMinutos(hora);
  if (horaTurno < horaMin || horaTurno > horaMax) {
    const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    return `El horario de atención es de ${fmt(horaMin)} a ${fmt(horaMax)}hs.`;
  }

  const turnosDelCliente = turnosDelDia.filter(t =>
    t.cliente_id === clienteId &&
    t.estado === 'confirmado' &&
    t.id !== excluirTurnoId
  );

  // ── Máximo de turnos por cliente por día (solo al crear) ──
  if (aplicarMaxPorCliente && turnosDelCliente.length >= MAX_TURNOS_POR_CLIENTE) {
    return `El cliente ya tiene el máximo de ${MAX_TURNOS_POR_CLIENTE} turnos para este día.`;
  }

  // ── Servicio repetido el mismo día ─────────────────────────
  const serviciosYaAgendados = new Set(
    turnosDelCliente.flatMap(t => t.servicios.filter(s => s != null).map(s => s.id))
  );
  const repetidos = servicioIds.filter(id => serviciosYaAgendados.has(id));
  if (repetidos.length > 0) {
    const nombresRepetidos = servicios
      .filter(s => repetidos.includes(s.id))
      .map(s => s.nombre)
      .join(', ');
    return `El cliente ya tiene agendado: ${nombresRepetidos} para este día.`;
  }

  // ── Choque de horario ──────────────────────────────────────
  const duracionTotal = servicios
    .filter(s => servicioIds.includes(s.id))
    .reduce((sum, s) => sum + s.duracion_minutos, 0);
  const inicioNuevo = horaTurno;
  const finNuevo     = horaTurno + duracionTotal;

  const otrosTurnosDelDia = turnosDelDia.filter(t =>
    t.estado === 'confirmado' && t.id !== excluirTurnoId
  );

  for (const t of otrosTurnosDelDia) {
    const inicioExistente = toMinutos(horaDeFechaHora(t.fecha_hora));
    const finExistente     = inicioExistente + t.duracion_total_minutos;
    const hayChoque = inicioExistente < finNuevo && finExistente > inicioNuevo;
    if (hayChoque) {
      const nombreCliente   = t.cliente ? `${t.cliente.nombre} ${t.cliente.apellido}` : 'otro cliente';
      const serviciosChoque = t.servicios.filter(s => s != null).map(s => s.nombre).join(' + ');
      const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      return `Las ${fmt(horaTurno)} cae dentro del turno de ${nombreCliente} (${serviciosChoque}, ${fmt(inicioExistente)} - ${fmt(finExistente)}). Elegí otro horario.`;
    }
  }

  return null;
}
