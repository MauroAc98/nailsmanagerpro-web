import api from '@/lib/api';

// Bloqueo de agenda: fecha puntual (o rango horario dentro de esa fecha) en
// la que una profesional puntual, o el salón entero, no atiende. Ambos
// horarios null = bloqueo de día completo; ambos presentes = bloqueo
// parcial (invariante validado por el backend en el POST, ver
// BloqueoAgendaController::store).
export interface BloqueoAgenda {
  id: number;
  user_id: number;
  // null = bloqueo para todo el salón (todas las profesionales).
  profesional_id: number | null;
  fecha: string;                  // "YYYY-MM-DD"
  hora_desde: string | null;      // "HH:MM"
  hora_hasta: string | null;      // "HH:MM"
  motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBloqueoAgendaDto {
  profesional_id?: number | null;
  fecha: string;                  // "YYYY-MM-DD", debe ser >= hoy (validado por el backend)
  hora_desde?: string | null;     // ambos presentes o ambos ausentes
  hora_hasta?: string | null;
  motivo?: string | null;
}

// ─────────────────────────────────────────────
// Service — mismo criterio que categoriaServicioService: sin `update`, el
// backend expone solo index/store/destroy (editar = borrar + recrear, ver
// design.md > Architecture Decisions).
// ─────────────────────────────────────────────
export const bloqueoAgendaService = {
  getAll: async (): Promise<BloqueoAgenda[]> => {
    const { data } = await api.get<BloqueoAgenda[]>('/bloqueos');
    return data;
  },

  create: async (dto: CreateBloqueoAgendaDto): Promise<BloqueoAgenda> => {
    const { data } = await api.post<BloqueoAgenda>('/bloqueos', dto);
    return data;
  },

  // El backend responde 409 si ya existe un bloqueo idéntico para esa
  // fecha/profesional/horario — ese body llega vía `extraerMensajeError`,
  // sin manejo especial acá (mismo criterio que categoriaServicioService.delete).
  delete: async (id: number): Promise<void> => {
    await api.delete(`/bloqueos/${id}`);
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
