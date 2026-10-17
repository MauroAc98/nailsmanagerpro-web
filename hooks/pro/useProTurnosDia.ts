'use client';

import { proService } from '@/services/proService';
import { cacheTurnosDia } from '@/lib/pro/caches';
import { esFechaValida } from '@/lib/pro/fechaHora';
import type { ProListaTurnos } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

// Turnos de UN día ("YYYY-MM-DD") del negocio activo. Cambiar de día pide de
// nuevo (la respuesta del día anterior se descarta); `data` trae `truncated` y
// `descartados`.
export function useProTurnosDia(fecha: string): ProRecurso<ProListaTurnos> {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const clave = vinculoId !== null && esFechaValida(fecha) ? `${vinculoId}:dia:${fecha}` : null;
  return useProRecurso(
    clave,
    (signal) => proService.turnos(vinculoId as number, { fecha }, signal),
    cacheTurnosDia,
  );
}
