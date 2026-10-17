'use client';

import { proService } from '@/services/proService';
import { cacheResumen } from '@/lib/pro/caches';
import type { ProResumen } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Resumen del mes ("YYYY-MM") del negocio activo: `data` es ProResumen. Un mes
// inválido o vacío no pide nada.
export function useProResumen(mes: string): ProRecurso<ProResumen> {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const clave = vinculoId !== null && MES.test(mes) ? `${vinculoId}:resumen:${mes}` : null;
  return useProRecurso(clave, (signal) => proService.resumen(vinculoId as number, mes, signal), cacheResumen);
}
