import type { Servicio } from '@/services/servicioService';
import type { Slot } from '@/services/slotService';
import type { Turno, CreateLoteDto } from '@/services/turnoService';
import type { Profesional } from '@/services/profesionalService';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import { validarTurno } from '@/lib/turnoValidaciones';
import { advertenciaTurno } from '@/lib/turnoAdvertencias';
import { nombreDia, nombreMes } from '@/lib/dateFormat';
import { tStatic, useLocaleStore } from '@/store/useLocaleStore';

// ─────────────────────────────────────────────
// Lógica pura de "varios turnos para un mismo cliente" (pantalla Nuevo turno).
// Un BLOQUE es un turno a cargar: día, hora, servicios y (si aplica) profesional.
// El cliente es uno solo, compartido por todos los bloques.
// ─────────────────────────────────────────────
export interface BloqueTurno {
  fecha: string;                 // "YYYY-MM-DD"
  hora: string;                  // "HH:MM"
  servicioIds: number[];
  profesionalId: number | null;  // null = sin selector de profesional (cuenta con ≤1 activa)
}

/** Payload de POST /turnos/lote: mismo formato de fecha que un turno suelto. */
export function armarPayloadLote(clienteId: number, bloques: BloqueTurno[]): CreateLoteDto {
  return {
    cliente_id: clienteId,
    turnos: bloques.map(b => ({
      fecha_hora: `${b.fecha} ${b.hora}`,
      servicio_ids: b.servicioIds,
      ...(b.profesionalId != null ? { profesional_id: b.profesionalId } : {}),
    })),
  };
}

/** Bloque vacío que hereda día y profesional del anterior. */
export function bloqueNuevoDesde(anterior: BloqueTurno, horaInicial: string): BloqueTurno {
  return { fecha: anterior.fecha, hora: horaInicial, servicioIds: [], profesionalId: anterior.profesionalId };
}

/** Quita un bloque (nunca el único) y dice cuál queda abierto: el anterior, o el primero. */
export function quitarBloque(bloques: BloqueTurno[], indice: number): { bloques: BloqueTurno[]; activo: number } {
  if (bloques.length <= 1) return { bloques, activo: 0 };
  return { bloques: bloques.filter((_, i) => i !== indice), activo: Math.max(0, indice - 1) };
}

// ── Textos del resumen plegado ────────────────
/** "15:30" → "3:30 p. m." */
export function horaCorta12(hora24: string): string {
  const [h, m] = hora24.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p. m.' : 'a. m.'}`;
}

/** "lun 12 oct · 3:30 p. m." */
export function tituloResumen(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${nombreDia(d, 'short', 'ninguna')} ${d.getDate()} ${nombreMes(d, 'short', 'ninguna')} · ${horaCorta12(hora)}`;
}

/** "martes 14 de octubre" (sin coma). */
export function diaLargo(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return new Intl.DateTimeFormat(useLocaleStore.getState().locale, { weekday: 'long', day: 'numeric', month: 'long' })
    .format(d)
    .replace(',', '');
}

/** "Esmaltado + Retiro · con Lucía" — `conProfesional` ya viene traducido (o null). */
export function detalleResumen(nombresServicios: string[], conProfesional?: string | null): string {
  return [nombresServicios.join(' + '), conProfesional].filter(Boolean).join(' · ');
}

/** Datos de un turno creado para armar su confirmación manual por WhatsApp. */
export interface ItemConfirmacion {
  fecha: string;      // "YYYY-MM-DD"
  hora: string;       // "HH:MM"
  servicios: string;  // nombres unidos con " + "
}

export function itemsDeConfirmacion(turnos: Turno[]): ItemConfirmacion[] {
  return turnos.map(t => ({
    fecha: t.fecha_hora.slice(0, 10),
    hora: t.fecha_hora.slice(11, 16),
    servicios: t.servicios.filter(s => s != null).map(s => s.nombre).join(' + '),
  }));
}

// ── Validación de un bloque ───────────────────
interface EvaluarBloqueParams {
  bloque: BloqueTurno;
  clienteId: number;
  servicios: Servicio[];
  turnos: Turno[];              // turnos cargados (de cualquier día/profesional)
  slots: Slot[];
  bloqueos: BloqueoAgenda[];
  profesional: Profesional | null;   // para el aviso de días/bloqueos
  requiereProfesional: boolean;      // hay selector visible: la elección es obligatoria
}

/**
 * Mismas reglas que el turno suelto: `error` bloquea (validarTurno), `advertencia`
 * se confirma con el usuario (advertenciaTurno). Los turnos existentes se recortan
 * al día (y a la profesional) del bloque, igual que hace la pantalla con un solo turno.
 */
export function evaluarBloque({
  bloque, clienteId, servicios, turnos, slots, bloqueos, profesional, requiereProfesional,
}: EvaluarBloqueParams): { error: string | null; advertencia: string | null } {
  if (bloque.servicioIds.length === 0) {
    return { error: tStatic('validation.TurnoValidaciones.serviciosFaltan'), advertencia: null };
  }
  if (requiereProfesional && !bloque.profesionalId) {
    return { error: tStatic('validation.TurnoValidaciones.profesionalFalta'), advertencia: null };
  }

  const turnosDelDia = turnos.filter(t =>
    t.fecha_hora.slice(0, 10) === bloque.fecha &&
    (!requiereProfesional || !bloque.profesionalId || t.profesional_id === bloque.profesionalId)
  );
  const error = validarTurno({
    fecha: bloque.fecha,
    hora: bloque.hora,
    clienteId,
    servicioIds: bloque.servicioIds,
    servicios,
    turnosDelDia,
    slots,
    aplicarMaxPorCliente: true,
  });
  if (error) return { error, advertencia: null };

  const duracionMinutos = servicios
    .filter(s => bloque.servicioIds.includes(s.id))
    .reduce((sum, s) => sum + s.duracion_minutos, 0);
  const advertencia = advertenciaTurno({
    fecha: bloque.fecha, hora: bloque.hora, duracionMinutos, profesional, bloqueos,
  });
  return { error: null, advertencia };
}
