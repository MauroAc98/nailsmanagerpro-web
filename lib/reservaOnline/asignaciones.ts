import type { Asignacion } from './types';

// La reserva online pide disponibilidad y retiene SIEMPRE con `asignaciones`:
// un grupo por servicio(s) + su profesional (sin profesional = "Cualquiera",
// solo valido con un unico grupo). El flujo de siempre (una profesional o
// "Cualquiera") es un unico grupo con todos los servicios.
export const asignacionesDe = (q: {
  servicioIds: number[];
  profesionalId?: number;
  asignaciones?: Asignacion[];
}): Asignacion[] => q.asignaciones ?? [{ servicioIds: q.servicioIds, profesionalId: q.profesionalId }];

export const asignacionesAWire = (grupos: Asignacion[]) =>
  grupos.map((g) => ({
    servicio_ids: g.servicioIds,
    ...(g.profesionalId ? { profesional_id: g.profesionalId } : {}),
  }));
