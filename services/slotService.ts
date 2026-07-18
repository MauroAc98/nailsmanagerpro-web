import api from '@/lib/api';

export interface Slot {
  id: number;
  user_id: number;
  hora: string;
  activo: boolean;
}

export const slotService = {
  // profesionalId opcional — el backend filtra server-side cuando se manda,
  // devuelve los slots de la profesional default de la cuenta cuando se
  // omite (comportamiento previo, intacto para RN). Mismo patrón opcional
  // que turnoService.getByMes.
  getAll: async (profesionalId?: number): Promise<Slot[]> => {
    const { data } = await api.get<Slot[]>('/slots', {
      params: profesionalId ? { profesional_id: profesionalId } : undefined,
    });
    return data;
  },

  create: async (hora: string, profesionalId?: number): Promise<Slot> => {
    const { data } = await api.post<Slot>('/slots', {
      hora,
      ...(profesionalId ? { profesional_id: profesionalId } : {}),
    });
    return data;
  },

  toggleActivo: async (id: number, activo: boolean): Promise<Slot> => {
    const { data } = await api.put<Slot>(`/slots/${id}`, { activo });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/slots/${id}`);
  },
};
