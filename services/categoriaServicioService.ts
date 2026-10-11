import api from '@/lib/api';

export interface CategoriaServicio {
  id: number;
  user_id: number;
  nombre: string;
  // URL publica del fondo fijo de "generar historia" para esta categoria
  // (misma convencion que Profesional.fondo_historia_url), null si no hay.
  fondo_historia_url: string | null;
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

  // Fondo fijo de "generar historia" por categoria. Mismo request que
  // profesionalService.subirFondoHistoria: Content-Type undefined para que
  // axios arme el multipart (la instancia `api` fuerza JSON por default) y
  // timeout largo para subidas pesadas desde un celular con mala senal.
  subirFondoHistoria: async (id: number, archivo: File): Promise<CategoriaServicio> => {
    const form = new FormData();
    form.append('imagen', archivo);
    const { data } = await api.post<CategoriaServicio>(`/categorias-servicio/${id}/fondo-historia`, form, {
      headers: { 'Content-Type': undefined },
      timeout: 60_000,
    });
    return data;
  },

  borrarFondoHistoria: async (id: number): Promise<CategoriaServicio> => {
    const { data } = await api.delete<CategoriaServicio>(`/categorias-servicio/${id}/fondo-historia`);
    return data;
  },
};
