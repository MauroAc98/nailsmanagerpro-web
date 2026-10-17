'use client';

import { proService } from '@/services/proService';
import { cacheMarcas } from '@/lib/pro/caches';
import type { ProMarcas } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Marcas del mes ("YYYY-MM") del negocio activo: `data` es { dias, descartados }.
export function useProMarcasMes(mes: string): ProRecurso<ProMarcas> {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const clave = vinculoId !== null && MES.test(mes) ? `${vinculoId}:marcas:${mes}` : null;
  return useProRecurso(clave, (signal) => proService.marcas(vinculoId as number, mes, signal), cacheMarcas);
}
