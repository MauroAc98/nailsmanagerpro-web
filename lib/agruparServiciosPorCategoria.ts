import { Servicio } from '@/services/servicioService';
import { CategoriaServicio } from '@/services/categoriaServicioService';

export interface GrupoServiciosCategoria {
  // null = "Sin categoria" — siempre al final (ver `agruparServiciosPorCategoria`),
  // nunca aparece si no hay servicios sin categorizar.
  id:         number | null;
  nombre:     string;
  servicios:  Servicio[];
}

// Regla de agrupamiento compartida (orden = orden de `categorias`, ya
// alfabético desde el backend — ver useCategoriasServicioStore). "Sin
// categoria" se agrega al final solo si tiene servicios; una categoría sin
// servicios asignados no genera grupo. Extraída de
// `configuracion/servicios/page.tsx` (antes local ahí como
// `agruparPorCategoria`) para que el picker de servicios de profesionales
// reuse la misma regla sin duplicarla — a diferencia del original, esta
// versión NO sub-particiona por `es_promo`: eso es específico de la
// pantalla de servicios, no del picker de profesionales.
export function agruparServiciosPorCategoria(
  servicios: Servicio[],
  categorias: CategoriaServicio[]
): GrupoServiciosCategoria[] {
  const grupos: GrupoServiciosCategoria[] = [];

  for (const categoria of categorias) {
    const deLaCategoria = servicios.filter(s => s.categoria_id === categoria.id);
    if (deLaCategoria.length === 0) continue;
    grupos.push({
      id: categoria.id,
      nombre: categoria.nombre,
      servicios: deLaCategoria,
    });
  }

  const sinCategoria = servicios.filter(s => s.categoria_id === null);
  if (sinCategoria.length > 0) {
    grupos.push({
      id: null,
      nombre: '', // resuelto en el render vía t('sinCategoria')
      servicios: sinCategoria,
    });
  }

  return grupos;
}
