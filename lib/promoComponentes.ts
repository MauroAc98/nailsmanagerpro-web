import type { ComponentePromo, ModoPromo, ProblemaPromo, Servicio } from '@/services/servicioService';
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

// Paralelo is offerable only when the studio setting is on AND there is
// more than one active professional to actually parallelize with.
export const paraleloDisponible = (atiendeEnParalelo: boolean | undefined, activeProfesionales: number): boolean =>
  !!atiendeEnParalelo && activeProfesionales > 1;

// Swaps a row with its neighbor (delta -1 = up, +1 = down); a no-op past
// either edge. Array position IS the saved `orden` (backend: orden =
// array position 1..N) — there is no separate `.orden` field to keep in
// sync, so a plain swap is the whole reorder, unlike list types that pin a
// persisted `.orden` (see reordenarEnSitio for that other case).
export const moverFila = (componentes: ComponenteDraft[], index: number, delta: -1 | 1): ComponenteDraft[] => {
  const destino = index + delta;
  if (destino < 0 || destino >= componentes.length) return componentes;
  const next = [...componentes];
  [next[index], next[destino]] = [next[destino], next[index]];
  return next;
};

// Derived duration from the CATALOG durations of the chosen rows (never the
// saved componente row's own duracion_minutos, which can go stale — see
// PromoComponentes::detalle on the backend for the same live-vs-persisted
// distinction). paralelo = longest tramo; secuencia = back to back.
export const duracionDerivada = (modo: ModoPromo, componentes: ComponenteDraft[], servicios: Servicio[]): number => {
  const duraciones = componentes
    .filter(c => c.servicioId !== null)
    .map(c => servicios.find(s => s.id === c.servicioId)?.duracion_minutos ?? 0);
  if (duraciones.length === 0) return 0;
  return modo === 'paralelo' ? Math.max(...duraciones) : duraciones.reduce((a, b) => a + b, 0);
};

// Sum of the chosen rows' standalone catalog prices — shown as the price
// field's reference hint and used to decide whether a typed price is an
// override (see precioAGuardar).
export const sumaComponentes = (componentes: ComponenteDraft[], servicios: Servicio[]): number =>
  componentes.reduce((suma, c) => {
    if (c.servicioId === null) return suma;
    const precio = servicios.find(s => s.id === c.servicioId)?.precio;
    return suma + (precio ? parseFloat(precio) : 0);
  }, 0);

// What to send as `precio` in the PUT: null (use the derived sum) when the
// field is empty or equals the sum, otherwise the typed override. Callers
// MUST use a dedicated state for this (never the legacy `precio` field) —
// reusing it made a promo going from 0 to its first component inherit the
// old legacy price as a false override.
export const precioAGuardar = (precioComponentes: string, suma: number): number | null => {
  if (!precioComponentes.trim()) return null;
  const n = parseFloat(precioComponentes);
  return Number.isNaN(n) || n === suma ? null : n;
};

// What to preload the dedicated price state with when a promo already has
// components: empty unless the persisted price differs from the LIVE
// component sum, in which case it must be an override (or a sum that went
// stale — either way worth showing so the admin sees it doesn't match the
// current reference hint).
export const precioInicialComponentes = (servicio: Pick<Servicio, 'precio' | 'precio_componentes'>): string => {
  const suma = servicio.precio_componentes;
  if (suma === null || suma === undefined) return '';
  const persistido = servicio.precio !== null ? parseFloat(servicio.precio) : null;
  return persistido !== null && persistido !== suma ? servicio.precio! : '';
};
