import api from '@/lib/api';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Turno {
  id: number;
  cliente_id: number;
  cliente: { nombre: string; apellido: string; telefono?: string };
  // pivot solo viene poblado (precio no-null) una vez que el turno se
  // completó con precios cargados — antes de eso, o para turnos que cayeron
  // en "pendientes de cobro", precio es null. Laravel serializa decimal
  // como string, igual que Servicio.precio.
  servicios: { id: number; nombre: string; pivot?: { precio: string | null } }[];
  fecha_hora: string;              // "YYYY-MM-DD HH:MM:SS" or ISO
  duracion_total_minutos: number;
  estado: 'confirmado' | 'completado' | 'cancelado';
  estado_visual: 'confirmado' | 'completado' | 'cancelado' | 'en_curso';
  notas?: string | null;
  motivo_cancelacion?: string | null;
  cancelado_en?: string | null;
  // Siempre presente en la respuesta (columna propia del turno — el backend
  // la resuelve server-side al default de la cuenta cuando no se manda), pero
  // NUNCA viene con el objeto `profesional` anidado: TurnoController no hace
  // eager-load de esa relación (a diferencia de `cliente`/`servicios`). Para
  // mostrar nombre/color hay que resolverlo contra useProfesionalStore.
  profesional_id?: number | null;
}

// Un evento real de WhatsApp automático de hoy (confirmación al agendar,
// recordatorio a la hora configurada) — ver TurnoController::notificaciones.
// 'pending'/'delivered'/'read' llegan del webhook de Meta a medida que el
// mensaje avanza; 'failed' es error de envío; 'manual' es un recordatorio
// marcado a mano (ver marcarRecordatorioManual).
export interface NotificacionMensaje {
  id: number;
  tipo: 'confirmacion' | 'recordatorio';
  status: 'pending' | 'delivered' | 'read' | 'failed' | 'manual';
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  created_at: string;
  // Texto real armado por WhatsappTemplate::mensajeLegible() al momento
  // del envío (backend) — se guarda tal cual, no es una reconstrucción.
  mensaje: string;
}

export interface Notificaciones {
  turnos_manana: number;
  // Mensajes posteriores a users.notificaciones_vistas_at — para el número
  // del badge de la campanita. `mensajes` de abajo trae SIEMPRE la lista
  // completa de hoy (vistos o no), esto es solo el contador.
  no_vistos: number;
  mensajes: NotificacionMensaje[];
}

// Turno de referencia para /agenda/manana — mismo shape que Turno más el
// estado del recordatorio de ESE turno puntual (null = todavía no se
// mandó). A diferencia de recordatoriosPendientes(), esta lista incluye
// TODOS los turnos confirmados de mañana, ya tengan recordatorio o no.
export interface TurnoManana extends Turno {
  recordatorio_status: 'pending' | 'delivered' | 'read' | 'failed' | 'manual' | null;
}

export interface TurnoMes {
  fecha: string;   // "YYYY-MM-DD"
  cantidad: number;
}

export interface CreateTurnoDto {
  cliente_id: number;
  servicio_ids: number[];
  fecha_hora: string;   // "YYYY-MM-DD HH:MM"
  notas?: string;
  // Opcional — si se omite, el backend resuelve al profesional default de
  // la cuenta. Nunca marcar como requerido (multi-agenda es aditivo).
  profesional_id?: number;
}

export type UpdateTurnoDto = Partial<CreateTurnoDto>;

export interface SlotDisponibilidad {
  hora: string;    // pre-formatted, e.g. "9hs" or "9:30hs"
  libre: boolean;
}

export interface DisponibilidadDia {
  fecha: string;   // "YYYY-MM-DD"
  slots: SlotDisponibilidad[];
}

// ─────────────────────────────────────────────
// Search filters — mirrors RN's typed union: the index endpoint accepts
// exactly ONE of these params at a time (fecha | buscar | servicio_id),
// plus the desde/hasta range branch that TurnoController::index also
// supports.
// ─────────────────────────────────────────────
export type FiltrosTurnos =
  | { fecha: string }
  | { buscar: string }
  | { servicio_id: number }
  | { desde: string; hasta: string };

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const turnoService = {
  getTurnos: async (filtros: FiltrosTurnos): Promise<Turno[]> => {
    const { data } = await api.get<Turno[]>('/turnos', { params: filtros });
    return data;
  },

  getAll: (fecha: string): Promise<Turno[]> => turnoService.getTurnos({ fecha }),

  buscarPorNombre:   (nombre: string): Promise<Turno[]> => turnoService.getTurnos({ buscar: nombre }),
  buscarPorServicio: (id: number):     Promise<Turno[]> => turnoService.getTurnos({ servicio_id: id }),
  buscarPorFecha:    (fecha: string):  Promise<Turno[]> => turnoService.getTurnos({ fecha }),
  buscarPorRango:    (desde: string, hasta: string): Promise<Turno[]> => turnoService.getTurnos({ desde, hasta }),

  // profesionalId opcional — el backend filtra server-side cuando se manda,
  // devuelve el conteo total de la cuenta cuando se omite (comportamiento
  // previo, intacto para RN).
  getByMes: async (mes: string, profesionalId?: number): Promise<TurnoMes[]> => {
    const { data } = await api.get<Record<string, { cantidad: number }>>('/turnos/marcas', {
      params: { mes, ...(profesionalId ? { profesional_id: profesionalId } : {}) },
    });
    return Object.entries(data).map(([fecha, v]) => ({ fecha, cantidad: v.cantidad }));
  },

  getOne: async (id: number): Promise<Turno> => {
    const { data } = await api.get<Turno>(`/turnos/${id}`);
    return data;
  },

  create: async (dto: CreateTurnoDto): Promise<Turno> => {
    const { data } = await api.post<Turno>('/turnos', dto);
    return data;
  },

  update: async (id: number, dto: UpdateTurnoDto): Promise<Turno> => {
    const { data } = await api.put<Turno>(`/turnos/${id}`, dto);
    return data;
  },

  completar: async (
    id: number,
    servicios?: { servicio_id: number; precio: number }[]
  ): Promise<Turno> => {
    const { data } = await api.patch<Turno>(
      `/turnos/${id}/completar`,
      servicios ? { servicios } : undefined
    );
    return data;
  },

  delete: async (id: number, motivoCancelacion: string): Promise<void> => {
    await api.delete(`/turnos/${id}`, { data: { motivo_cancelacion: motivoCancelacion } });
  },

  pendientesDeCobro: async (): Promise<Turno[]> => {
    const { data } = await api.get<Turno[]>('/turnos/pendientes-de-cobro');
    return data;
  },

  recordatoriosPendientes: async (): Promise<Turno[]> => {
    const { data } = await api.get<Turno[]>('/turnos/recordatorios-pendientes');
    return data;
  },

  turnosManana: async (): Promise<TurnoManana[]> => {
    const { data } = await api.get<TurnoManana[]>('/turnos/manana');
    return data;
  },

  marcarRecordatorioManual: async (turnoId: number): Promise<void> => {
    await api.post(`/turnos/${turnoId}/recordatorio-manual`);
  },

  notificaciones: async (): Promise<Notificaciones> => {
    const { data } = await api.get<Notificaciones>('/turnos/notificaciones');
    return data;
  },

  marcarNotificacionesVistas: async (): Promise<void> => {
    await api.post('/turnos/notificaciones/marcar-vistas');
  },

  actualizarPrecios: async (
    id: number,
    servicios: { servicio_id: number; precio: number }[]
  ): Promise<Turno> => {
    const { data } = await api.patch<Turno>(`/turnos/${id}/precios`, { servicios });
    return data;
  },

  // profesionalId opcional — mismo patrón que getByMes/slotService.getAll:
  // el backend filtra server-side, cae al default de la cuenta si se omite.
  getDisponibilidad: async (desde: string, hasta: string, profesionalId?: number): Promise<DisponibilidadDia[]> => {
    const { data } = await api.get<DisponibilidadDia[]>('/turnos/disponibilidad', {
      params: { desde, hasta, ...(profesionalId ? { profesional_id: profesionalId } : {}) },
    });
    return data;
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
