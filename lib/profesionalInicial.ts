import { profesionalJefa, type Profesional } from '@/services/profesionalService';

// Default de los formularios de gasto/ingreso nuevos: la jefa, o null
// ("Del negocio") si todavía no hay profesionales cargadas.
export function profesionalInicialId(profesionales: Profesional[]): number | null {
  return profesionalJefa(profesionales)?.id ?? null;
}
