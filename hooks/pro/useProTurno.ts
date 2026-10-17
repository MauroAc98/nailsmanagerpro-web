'use client';

import { proService } from '@/services/proService';
import { cacheTurno, cacheTurnosDia } from '@/lib/pro/caches';
import type { ProTurno } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

// Detalle de un turno del negocio activo. Si se pasa `fecha` (el día desde el
// que se abrió) y ese día está en la caché, el turno de la lista se muestra al
// instante mientras llega el detalle; un error de refresco lo conserva. Las
// claves de la semilla y del detalle llevan el negocio activo: nunca se ve un
// turno de otro negocio.
export function useProTurno(id: number, fecha?: string): ProRecurso<ProTurno> {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const idValido = Number.isSafeInteger(id) && id > 0;
  const clave = vinculoId !== null && idValido ? `${vinculoId}:turno:${id}` : null;
  const recurso = useProRecurso(clave, (signal) => proService.turno(vinculoId as number, id, signal), cacheTurno);

  if (recurso.data !== null || clave === null || fecha === undefined) return recurso;
  const semilla = cacheTurnosDia.get(`${vinculoId}:dia:${fecha}`)?.turnos.find((t) => t.id === id) ?? null;
  return { ...recurso, data: semilla };
}
