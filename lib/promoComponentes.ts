import type { ComponentePromo, ProblemaPromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { extraerMensajeError } from '@/services/clienteService';

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
// rows are left out — the page refuses to save while one exists instead
// (see filaIncompleta/hayFilaIncompleta below).
export const payloadComponentes = (drafts: ComponenteDraft[]) =>
  drafts.flatMap(d => (d.servicioId !== null && d.profesionalId !== null
    ? [{ servicio_id: d.servicioId, profesional_id: d.profesionalId }]
    : []));

// A row must have BOTH fields chosen or NEITHER — one without the other
// can never be saved and must block the whole form.
export const filaIncompleta = (fila: ComponenteDraft): boolean =>
  (fila.servicioId === null) !== (fila.profesionalId === null);

export const hayFilaIncompleta = (drafts: ComponenteDraft[]): boolean =>
  drafts.some(filaIncompleta);

// A displayable row problem — satisfied by both real ProblemaPromo entries
// and synthetic save-time validation errors (see erroresGuardarComponentes).
export type ProblemaFila = Pick<ProblemaPromo, 'orden' | 'mensaje'>;

// Problems that belong to one specific row (orden is 1-based = index + 1).
// `sin_inicios_alineados` (orden null) is a promo-wide problem, PR 2d's job.
export const problemasDeFila = (problemas: ProblemaFila[], index: number): ProblemaFila[] =>
  problemas.filter(p => p.orden === index + 1);

export interface ErroresGuardarComponentes {
  porFila: Record<number, string>;
  modoHint?: string;
  general?: string;
}

// Maps a PUT /componentes 422 into what the form needs: a message per row
// (keys `componentes.{i}.servicio_id|profesional_id`, i already 0-based),
// a mode hint (`paralelo_no_habilitado`), or a generic fallback message.
export const erroresGuardarComponentes = (e: unknown): ErroresGuardarComponentes => {
  if (e && typeof e === 'object' && 'response' in e) {
    const err = e as { response?: { data?: { message?: string; code?: string; errors?: Record<string, string[]> } } };
    const data = err.response?.data;
    if (data?.code === 'paralelo_no_habilitado') return { porFila: {}, modoHint: data.message ?? '' };
    const porFila: Record<number, string> = {};
    for (const [key, msgs] of Object.entries(data?.errors ?? {})) {
      const m = /^componentes\.(\d+)\.(servicio_id|profesional_id)$/.exec(key);
      if (m && msgs[0] !== undefined) porFila[Number(m[1])] = msgs[0];
    }
    if (Object.keys(porFila).length > 0) return { porFila };
  }
  return { porFila: {}, general: extraerMensajeError(e) };
};
