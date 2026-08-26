import api from '@/lib/api';

export interface CategoriaServicio {
  id: number;
  user_id: number;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoriaServicioDto {
  nombre: string;
}

export interface UpdateCategoriaServicioDto {
  nombre?: string;
}

export const categoriaServicioService = {
  getAll: async (): Promise<CategoriaServicio[]> => {
    const { data } = await api.get<CategoriaServicio[]>('/categorias-servicio');
    return data;
  },

  getOne: async (id: number): Promise<CategoriaServicio> => {
    const { data } = await api.get<CategoriaServicio>(`/categorias-servicio/${id}`);
    return data;
  },

  create: async (dto: CreateCategoriaServicioDto): Promise<CategoriaServicio> => {
    const { data } = await api.post<CategoriaServicio>('/categorias-servicio', dto);
    return data;
  },

  update: async (id: number, dto: UpdateCategoriaServicioDto): Promise<CategoriaServicio> => {
    const { data } = await api.put<CategoriaServicio>(`/categorias-servicio/${id}`, dto);
    return data;
  },

  // El backend devuelve 409 si la categoría tiene servicios asignados
  // (ver CategoriaServicioController::destroy) — ese body llega como
  // `err.response.data.message` y `extraerMensajeError` ya lo extrae sin
  // manejo especial acá, mismo criterio que servicioService.delete.
  delete: async (id: number): Promise<void> => {
    await api.delete(`/categorias-servicio/${id}`);
  },
};
