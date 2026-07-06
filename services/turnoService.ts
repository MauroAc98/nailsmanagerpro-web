import api from '@/lib/api';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Turno {
  id: number;
  cliente_id: number;
  cliente: { nombre: string; apellido: string; telefono?: string };
  servicios: { id: number; nombre: string }[];
  fecha_hora: string;              // "YYYY-MM-DD HH:MM:SS" or ISO
  duracion_total_minutos: number;
  estado: 'confirmado' | 'completado' | 'cancelado';
  estado_visual: 'confirmado' | 'completado' | 'cancelado' | 'en_curso';
  notas?: string | null;
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
// Service
// ─────────────────────────────────────────────
export const turnoService = {
  getAll: async (fecha: string): Promise<Turno[]> => {
    const { data } = await api.get<Turno[]>('/turnos', { params: { fecha } });
    return data;
  },

  getByMes: async (mes: string): Promise<TurnoMes[]> => {
    const { data } = await api.get<Record<string, { cantidad: number }>>('/turnos/marcas', { params: { mes } });
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

  completar: async (id: number): Promise<Turno> => {
    const { data } = await api.patch<Turno>(`/turnos/${id}/completar`);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/turnos/${id}`);
  },

  getDisponibilidad: async (desde: string, hasta: string): Promise<DisponibilidadDia[]> => {
    const { data } = await api.get<DisponibilidadDia[]>('/turnos/disponibilidad', { params: { desde, hasta } });
    return data;
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
