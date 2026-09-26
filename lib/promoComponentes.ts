import type { ComponentePromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';

// One editable row of the promo components section. Nulls = not chosen yet.
export interface ComponenteDraft {
  servicioId: number | null;
  profesionalId: number | null;
}

export const draftsDesdeDetalle = (componentes: ComponentePromo[] = []): ComponenteDraft[] =>
  [...componentes]
    .sort((a, b) => a.orden - b.orden)
    .map(c => ({ servicioId: c.servicio_id, profesionalId: c.profesional_id }));

// Only standalone catalog services can be components (never another promo
// or the promo being edited) and only the active ones are offered.
export const serviciosComponibles = (servicios: Servicio[], promoId: number): Servicio[] =>
  servicios.filter(s => s.activo && !s.es_promo && s.id !== promoId);

// Active professionals who currently offer the service.
export const profesionalesQueOfrecen = (servicioId: number | null, profesionales: Profesional[]): Profesional[] =>
  servicioId === null
    ? []
    : profesionales.filter(p => p.activo && p.servicios.some(s => s.id === servicioId));

// Rows with both fields chosen, in the shape the PUT expects. Half-filled
// rows are left out (2b-ii will refuse to save them instead).
export const payloadComponentes = (drafts: ComponenteDraft[]) =>
  drafts.flatMap(d => (d.servicioId !== null && d.profesionalId !== null
    ? [{ servicio_id: d.servicioId, profesional_id: d.profesionalId }]
    : []));
