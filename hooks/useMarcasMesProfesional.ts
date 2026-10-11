'use client';

import { useEffect, useState } from 'react';
import { turnoService, type TurnoMes } from '@/services/turnoService';
import { crearCacheLru } from '@/lib/cacheLru';

// Marcas del mes (badges del calendario) de UNA profesional. Recuerda las
// últimas vistas: al volver a una ya vista se muestran al instante y se
// refrescan de fondo; una nunca vista arranca sin marcas (nunca las de otra).
const cache = crearCacheLru<TurnoMes[]>(12);
export const vaciarCacheMarcasMes = () => cache.clear();

export function useMarcasMesProfesional(activo: boolean, profesionalId: number | null, viewDate: Date): TurnoMes[] {
  const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const clave = `${profesionalId}:${mes}`;
  const [cargado, setCargado] = useState<{ clave: string; data: TurnoMes[] } | null>(null);

  useEffect(() => {
    if (!activo || profesionalId === null) return;
    let cancelled = false;
    turnoService.getByMes(mes, profesionalId)
      .then(data => {
        if (cancelled) return;
        cache.set(clave, data);
        setCargado({ clave, data });
      })
      .catch(e => console.error('fetchTurnosMesFiltrado:', e));
    return () => { cancelled = true; };
  }, [activo, profesionalId, mes, clave]);

  if (!activo || profesionalId === null) return [];
  return cargado?.clave === clave ? cargado.data : (cache.get(clave) ?? []);
}
