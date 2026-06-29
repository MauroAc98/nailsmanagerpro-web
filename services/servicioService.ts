import api from '@/lib/api';

export interface Servicio {
  id: number;
  user_id: number;
  nombre: string;
  duracion_minutos: number;
  precio: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateServicioDto {
  nombre: string;
  duracion_minutos: number;
  precio?: number;
}

export interface UpdateServicioDto {
  nombre?: string;
  duracion_minutos?: number;
  precio?: number;
  activo?: boolean;
}

export const servicioService = {
  getAll: async (): Promise<Servicio[]> => {
    const { data } = await api.get<Servicio[]>('/servicios');
    return data;
  },

  getOne: async (id: number): Promise<Servicio> => {
    const { data } = await api.get<Servicio>(`/servicios/${id}`);
    return data;
  },

  create: async (dto: CreateServicioDto): Promise<Servicio> => {
    const { data } = await api.post<Servicio>('/servicios', dto);
    return data;
  },

  update: async (id: number, dto: UpdateServicioDto): Promise<Servicio> => {
    const { data } = await api.put<Servicio>(`/servicios/${id}`, dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/servicios/${id}`);
  },
};
