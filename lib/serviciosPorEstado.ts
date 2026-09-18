import type { Servicio } from '@/services/servicioService';

export type FiltroEstado = 'todos' | 'activos' | 'pausados';

export function filtrarPorEstado(servicios: Servicio[], filtro: FiltroEstado): Servicio[] {
  if (filtro === 'todos') return servicios;
  return servicios.filter(s => (filtro === 'activos' ? s.activo : !s.activo));
}

export function contarPorEstado(servicios: Servicio[]): Record<FiltroEstado, number> {
  const activos = servicios.filter(s => s.activo).length;
  return { todos: servicios.length, activos, pausados: servicios.length - activos };
}
