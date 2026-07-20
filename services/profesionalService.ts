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
  // Fondo fijo guardado para "generar historia" — null si esta profesional
  // no tiene uno guardado. Siempre viene como URL pública lista para usar
  // (appended por el backend), nunca como ruta interna del disco.
  fondo_historia_url: string | null;
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

  // Guarda (reemplaza) el fondo fijo de "generar historia" para esta
  // profesional. La instancia `api` fija 'Content-Type': 'application/json'
  // como default en TODOS los requests — sin pisarlo acá, axios manda el
  // FormData serializado como JSON (`{"imagen":{}}`) en vez de multipart,
  // y el backend responde 422 "The imagen field is required". Content-Type
  // undefined deja que axios/el browser arme el multipart con el boundary.
  subirFondoHistoria: async (id: number, archivo: File): Promise<Profesional> => {
    const form = new FormData();
    form.append('imagen', archivo);
    const { data } = await api.post<Profesional>(`/profesionales/${id}/fondo-historia`, form, {
      headers: { 'Content-Type': undefined },
    });
    return data;
  },

  borrarFondoHistoria: async (id: number): Promise<Profesional> => {
    const { data } = await api.delete<Profesional>(`/profesionales/${id}/fondo-historia`);
    return data;
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
