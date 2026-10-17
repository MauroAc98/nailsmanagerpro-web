// Agrupa los servicios del filtro por categoría con la misma regla que la app
// (lib/agruparServiciosPorCategoria), pero sobre el tipo del portal: así no se
// importa nada de los servicios ni de los stores del salón. Función pura.
//
// - Devuelve null cuando ningún servicio trae categoría: la hoja sale plana, igual
//   que con un backend que todavía no manda categorías.
// - Las categorías van ordenadas por nombre (el orden alfabético que usa la app).
// - "Sin categoría" (id null) va al final y solo si tiene servicios; su nombre queda
//   vacío porque la hoja usa su propio texto traducido.
// - Dentro de cada grupo se conserva el orden en que llegaron los servicios (el
//   backend ya los manda por orden, nombre e id).

import type { ProServicio } from '@/lib/pro/tipos';

export interface GrupoProServicios {
  id: number | null;
  nombre: string;
  servicios: ProServicio[];
}

export function agruparServicios(servicios: ProServicio[]): GrupoProServicios[] | null {
  if (!servicios.some((s) => s.categoria !== null)) return null;

  const porCategoria = new Map<number, GrupoProServicios>();
  const sinCategoria: ProServicio[] = [];
  for (const servicio of servicios) {
    const categoria = servicio.categoria;
    if (categoria === null) {
      sinCategoria.push(servicio);
      continue;
    }
    const grupo = porCategoria.get(categoria.id);
    if (grupo) grupo.servicios.push(servicio);
    else porCategoria.set(categoria.id, { id: categoria.id, nombre: categoria.nombre, servicios: [servicio] });
  }

  const grupos = [...porCategoria.values()].sort((a, b) => a.nombre.localeCompare(b.nombre) || a.id! - b.id!);
  if (sinCategoria.length > 0) grupos.push({ id: null, nombre: '', servicios: sinCategoria });
  return grupos;
}
