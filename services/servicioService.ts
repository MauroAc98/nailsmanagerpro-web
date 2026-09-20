import api from '@/lib/api';

// Una foto del portafolio de trabajos de un servicio. `orden` determina la
// posicion en la grilla del editor — index 0 (primera por `orden`) es la
// portada, misma convencion que `FotoHistoria` en profesionalService.
export interface FotoServicio {
  id: number;
  url: string;
  orden: number;
}

// Tope de fotos por servicio — espeja ServicioController::MAX_FOTOS_SERVICIO
// en el backend (defensa en profundidad: el backend igual lo valida).
export const MAX_FOTOS_SERVICIO = 12;

export interface Servicio {
  id: number;
  user_id: number;
  nombre: string;
  duracion_minutos: number;
  precio: string | null;
  activo: boolean;
  // Proyeccion de solo lectura del portafolio de fotos de trabajos,
  // ordenada por `orden`. Ausente/undefined en las respuestas de
  // index/show (el backend no las precarga ahi); solo viene poblada al
  // recibir la respuesta de subirFoto/borrarFoto/reordenarFotos (ver
  // FotosServicioEditor, que la trata como `?? []`).
  fotos?: FotoServicio[];
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

  // Agrega una foto al portafolio de trabajos de este servicio (no
  // reemplaza — agrega un slot nuevo, hasta MAX_FOTOS_SERVICIO). Mismo
  // motivo que profesionalService.subirFotoHistoriaPrecios para pisar el
  // Content-Type: sin esto axios serializa el FormData como JSON y el
  // backend responde 422. Devuelve el Servicio completo (incluye `fotos`
  // actualizado).
  subirFoto: async (id: number, archivo: File): Promise<Servicio> => {
    const form = new FormData();
    form.append('imagen', archivo);
    const { data } = await api.post<Servicio>(`/servicios/${id}/fotos`, form, {
      headers: { 'Content-Type': undefined },
      // Mismo timeout extendido que profesionalService (default 15s de
      // `api` es corto para una subida de imagen desde el celular).
      timeout: 60_000,
    });
    return data;
  },

  // Borra una foto puntual del portafolio por su id. Devuelve el Servicio
  // completo, igual que el resto de los endpoints de fotos.
  borrarFoto: async (id: number, fotoId: number): Promise<Servicio> => {
    const { data } = await api.delete<Servicio>(`/servicios/${id}/fotos/${fotoId}`);
    return data;
  },

  // Reordena las fotos del portafolio. `ids` es el array completo en el
  // nuevo orden. Devuelve el Servicio completo, igual que el resto de los
  // endpoints de fotos.
  reordenarFotos: async (id: number, ids: number[]): Promise<Servicio> => {
    const { data } = await api.patch<Servicio>(`/servicios/${id}/fotos/reordenar`, { ids });
    return data;
  },
};
