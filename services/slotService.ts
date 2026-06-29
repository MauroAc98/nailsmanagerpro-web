import api from '@/lib/api';

export interface Slot {
  id: number;
  user_id: number;
  hora: string;
  activo: boolean;
}

export const slotService = {
  getAll: async (): Promise<Slot[]> => {
    const { data } = await api.get<Slot[]>('/slots');
    return data;
  },

  create: async (hora: string): Promise<Slot> => {
    const { data } = await api.post<Slot>('/slots', { hora });
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
