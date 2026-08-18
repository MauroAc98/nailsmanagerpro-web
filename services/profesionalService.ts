import api from '@/lib/api';
import type { Servicio } from '@/services/servicioService';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
// Id de catálogo del picker de "historia de precios" — el catálogo (10
// plantillas fijas) vive en el frontend (components/historia-precios/catalogo.ts),
// por eso es un string literal union y no un id numérico con lookup en el
// backend. Reemplaza la vieja matriz LayoutId x EstiloId (3x3): ahora es un
// catálogo plano de looks curados, no una combinación de 2 ejes.
export type TemplateId =
  | 'editorial' | 'minimal' | 'rose' | 'modern' | 'split'
  | 'bold' | 'collage' | 'polaroid' | 'type' | 'grid';

// Una foto subida específicamente para la historia de precios (no reutiliza
// ninguna otra foto existente del profesional). `orden` determina el slot
// del layout al que se asigna — arranca por orden de subida, reordenable
// después vía drag-and-drop (ver GestorFotos).
export interface FotoHistoria {
  id: number;
  url: string;
  orden: number;
}

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
  // Selección actual del picker de "historia de precios" — null si la
  // profesional todavía no eligió plantilla.
  historia_precios_template_id: TemplateId | null;
  // Proyección de solo lectura: fotos subidas para la historia de precios,
  // en orden de subida. Se modifica vía los endpoints multipart de abajo,
  // nunca directamente por PUT /profesionales/{id}.
  historia_precios_fotos: FotoHistoria[];
}

// La profesional "jefa": la primera en crearse (id más chico) entre las
// activas. Es el default en toda la app cuando no hay una selección
// explícita — mismo criterio que ya usa el backend en
// Profesional::resolverParaUsuario (oldest('id')). El endpoint /profesionales
// devuelve la lista ordenada por nombre (para mostrar en selectores), así
// que activeProfesionales[0] NO es la jefa — hay que resolverla por id.
export function profesionalJefa(profesionales: Profesional[]): Profesional | null {
  const activas = profesionales.filter(p => p.activo);
  if (activas.length === 0) return null;
  return activas.reduce((min, p) => (p.id < min.id ? p : min), activas[0]);
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
  // Scalar picked from the frontend-owned catalog — same precedent as
  // `color`, patched through the main PUT. Photos go through the dedicated
  // multipart sub-resource below instead (see `subirFotoHistoriaPrecios`).
  historia_precios_template_id?: TemplateId | null;
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

  // Sube una foto dedicada a la historia de precios (no reemplaza, agrega un
  // slot nuevo — ver `borrarFotoHistoriaPrecios` para reemplazar/quitar).
  // Mismo motivo que `subirFondoHistoria` para pisar el Content-Type: sin
  // esto axios serializa el FormData como JSON y el backend responde 422.
  // Devuelve el Profesional completo (incluye `historia_precios_fotos`
  // actualizado) para que el reducer del store siga siendo un simple `map`.
  subirFotoHistoriaPrecios: async (id: number, archivo: File): Promise<Profesional> => {
    const form = new FormData();
    form.append('imagen', archivo);
    const { data } = await api.post<Profesional>(
      `/profesionales/${id}/historia-precios-fotos`,
      form,
      { headers: { 'Content-Type': undefined } },
    );
    return data;
  },

  // Borra una foto puntual de la historia de precios por su id de slot.
  // Devuelve el Profesional completo, igual que el resto de los endpoints
  // de fotos.
  borrarFotoHistoriaPrecios: async (id: number, fotoId: number): Promise<Profesional> => {
    const { data } = await api.delete<Profesional>(
      `/profesionales/${id}/historia-precios-fotos/${fotoId}`,
    );
    return data;
  },

  // Reordena las fotos de la historia de precios. `ids` es el array
  // completo en el nuevo orden. Devuelve el Profesional completo, igual
  // que el resto de los endpoints de fotos.
  reordenarFotosHistoriaPrecios: async (id: number, ids: number[]): Promise<Profesional> => {
    const { data } = await api.patch<Profesional>(
      `/profesionales/${id}/historia-precios-fotos/reordenar`,
      { ids },
    );
    return data;
  },
};

// Re-export from clienteService — do not duplicate the implementation
export { extraerMensajeError } from '@/services/clienteService';
