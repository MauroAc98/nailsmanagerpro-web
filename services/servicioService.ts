import api from '@/lib/api';

export interface Servicio {
  id: number;
  user_id: number;
  nombre: string;
  duracion_minutos: number;
  precio: string | null;
  activo: boolean;
  // Marca el servicio como promoción. Separa el catálogo en dos grupos
  // reordenables por separado (ver useServicioStore.reordenarServicios) y
  // determina el modo "Promociones" de la historia de precios — no es
  // puramente informativo (ver hooks/useHistoriaPrecios.ts).
  es_promo: boolean;
  // Posición dentro de su grupo (regular vs. promo), asignada por el
  // backend. `GET /servicios` ya devuelve el array ordenado por este
  // campo — el frontend nunca lo recalcula, solo lo reordena vía
  // `reordenar` (PATCH /servicios/reordenar).
  orden: number;
  // Categoría opcional (ver services/categoriaServicioService.ts). null =
  // "Sin categoría", nunca undefined — el backend siempre devuelve la
  // clave, con valor null cuando no hay categoría asignada.
  categoria_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateServicioDto {
  nombre: string;
  duracion_minutos: number;
  precio?: number;
  es_promo?: boolean;
  categoria_id?: number | null;
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
  // Mismo criterio que `precio`: null limpia la categoría, undefined deja
  // la clave afuera del PUT y el backend no la toca.
  categoria_id?: number | null;
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

  // Reordena UN solo grupo (regular o promo, nunca mezclados — ver
  // useServicioStore.reordenarServicios). `ids` es el array completo de
  // ese grupo en el nuevo orden; el backend responde con el catálogo
  // entero ya re-ordenado por `orden`.
  reordenar: async (ids: number[]): Promise<Servicio[]> => {
    const { data } = await api.patch<Servicio[]>('/servicios/reordenar', { ids });
    return data;
  },
};
