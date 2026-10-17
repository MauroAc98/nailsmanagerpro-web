'use client';

import { proService } from '@/services/proService';
import { cacheServicios } from '@/lib/pro/caches';
import type { ProServicios } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

// Servicios del negocio activo (opciones del filtro): `data` es { servicios, descartados }.
export function useProServicios(): ProRecurso<ProServicios> {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const clave = vinculoId !== null ? `${vinculoId}:servicios` : null;
  return useProRecurso(clave, (signal) => proService.servicios(vinculoId as number, signal), cacheServicios);
}
