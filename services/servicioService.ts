import api from '@/lib/api';

export interface Servicio {
  id: number;
  user_id: number;
  nombre: string;
  duracion_minutos: number;
  precio: string | null;
  activo: boolean;
  // Marca el servicio como promoción. Puramente informativo en v1: no
  // afecta la visibilidad (los inactivos se filtran igual por `activo`,
  // sin importar este flag) ni tiene un tratamiento visual distinto en la
  // historia de precios.
  es_promo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateServicioDto {
  nombre: string;
  duracion_minutos: number;
  precio?: number;
  es_promo?: boolean;
}

export interface UpdateServicioDto {
  nombre?: string;
  duracion_minutos?: number;
  // number | null (no solo number): null es la señal explícita de "borrar
  // el precio" que el caller debe mandar — un `undefined` desaparece al
  // serializar a JSON, así que el PUT saldría sin la clave y el backend
  // nunca se enteraría de que hay que limpiarlo (ver [id]/page.tsx).
  precio?: number | null;
  activo?: boolean;
  es_promo?: boolean;
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
