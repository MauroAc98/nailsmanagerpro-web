import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';

// Cómo se reparten los servicios ELEGIDOS en historias: todo junto, o una
// historia por categoría. La selección es la misma en ambos modos.
export type ModoHistorias = 'una' | 'categoria';

export interface Historia {
  id:        string;
  // null en modo 'una' (no hay categoría que mostrar).
  titulo:    string | null;
  servicios: Servicio[];
}

export function armarHistorias(
  serviciosSeleccionados: Servicio[],
  modo: ModoHistorias,
  categorias: CategoriaServicio[],
  sinCategoriaLabel = 'Sin categoría'
): Historia[] {
  if (serviciosSeleccionados.length === 0) return [];
  if (modo === 'una') return [{ id: 'una', titulo: null, servicios: serviciosSeleccionados }];

  return agruparServiciosPorCategoria(serviciosSeleccionados, categorias).map(g => ({
    id: g.id === null ? 'categoria-sin' : `categoria-${g.id}`,
    titulo: g.id === null ? sinCategoriaLabel : g.nombre,
    servicios: g.servicios,
  }));
}
