import api from '@/lib/api';
import type { Servicio } from '@/services/servicioService';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Profesional {
  id: number;
  user_id: number;
  nombre: string;
  color: string | null;
  activo: boolean;
  // Presente cuando el backend hace ->load('servicios') / ->with('servicios')
  // (index/store/update). Cada elemento trae además la pivot de
  // profesional_servicio, que acá no se tipa por no ser necesaria en el front.
  servicios: Servicio[];
}

export interface CreateProfesionalDto {
  nombre: string;
  color?: string;
  servicio_ids?: number[];
}

export interface UpdateProfesionalDto {
  nombre?: string;
  color?: string | null;
  activo?: boolean;
  servicio_ids?: number[];
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const profesionalService = {
  getAll: async (): Promise<Profesional[]> => {
    const { data } = await api.get<Profesional[]>('/profesionales');
    return data;
  },

  create: async (dto: CreateProfesionalDto): Promise<Profesional> => {
    const { data } = await api.post<Profesional>('/profesionales', dto);
    return data;
  },

  update: async (id: number, dto: UpdateProfesionalDto): Promise<Profesional> => {
    const { data } = await api.put<Profesional>(`/profesionales/${id}`, dto);
    return data;
  },

  // Soft-deactivate — el backend hace `activo = false`, no un delete real.
  // Mismo patrón que servicioService.delete, que en realidad pega al mismo
  // endpoint REST DELETE.
  delete: async (id: number): Promise<void> => {
    await api.delete(`/profesionales/${id}`);
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
