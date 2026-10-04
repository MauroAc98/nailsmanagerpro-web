import type { AlineacionSlots, ProblemaPromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import type { ComponenteDraft } from '@/lib/promoComponentes';

// What the top card of the edit screen says about booking a promo online.
// Built ONLY from structured data (codes, ids, hours): the backend `mensaje`
// strings are never shown, they contain jargon and gendered wording.
export type EstadoReservaOnline =
  | { tipo: 'ok'; nombres: string[] }
  | { tipo: 'pendiente'; ejemplo?: { a: string; hora: string; b: string; requerida: string } }
  | { tipo: 'bloqueo'; motivo: 'inactiva' | 'desvinculado'; nombre: string; servicio: string | null };

interface Entrada {
  componentes: ComponenteDraft[];
  profesionales: Profesional[];
  servicios: Servicio[];
  problemas: ProblemaPromo[];
  alineacion: AlineacionSlots;
}

export const estadoReservaOnline = ({ componentes, profesionales, servicios, problemas, alineacion }: Entrada): EstadoReservaOnline | null => {
  if (componentes.length === 0) return null;
  const nombreDe = (id: number | null) => profesionales.find(p => p.id === id)?.nombre ?? null;

  // A broken component is the only thing that needs fixing: it wins.
  const bloqueo = problemas.find(p => p.codigo === 'profesional_inactiva' || p.codigo === 'servicio_desvinculado');
  if (bloqueo) {
    return {
      tipo: 'bloqueo',
      motivo: bloqueo.codigo === 'profesional_inactiva' ? 'inactiva' : 'desvinculado',
      nombre: nombreDe(bloqueo.profesional_id) ?? '',
      servicio: servicios.find(s => s.id === bloqueo.servicio_id)?.nombre ?? null,
    };
  }

  const sinInicios = problemas.some(p => p.codigo === 'sin_inicios_alineados')
    || (alineacion.inicios_validos.length === 0 && alineacion.descartados.length > 0);
  if (sinInicios) {
    const descarte = alineacion.descartados[0];
    const lider = nombreDe(componentes[0].profesionalId);
    return descarte && lider
      ? { tipo: 'pendiente', ejemplo: { a: lider, hora: descarte.hora_inicio, b: descarte.profesional_nombre, requerida: descarte.hora_requerida } }
      : { tipo: 'pendiente' };
  }

  const nombres = componentes.flatMap(c => nombreDe(c.profesionalId) ?? []);
  return { tipo: 'ok', nombres: [...new Set(nombres)] };
};
