import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';
import { deriveEstadoCategoria } from '@/lib/deriveEstadoCategoria';

// Selección de servicios de la historia de precios. Se guarda como el set de
// ids EXCLUIDOS (no los incluidos): un servicio creado después entra por
// defecto, y el estado inicial (set vacío) equivale a "todo elegido", que es
// el comportamiento previo a esta feature.
export type ExcluidosHistoria = ReadonlySet<number>;
export type EstadoSeleccion = 'none' | 'some' | 'all';

export interface GrupoSeleccion {
  id:        number | null;
  nombre:    string;
  servicios: Servicio[];
  marcados:  number;
  total:     number;
  estado:    EstadoSeleccion;
}

const ESTADO: Record<ReturnType<typeof deriveEstadoCategoria>, EstadoSeleccion> = {
  unchecked: 'none',
  indeterminate: 'some',
  checked: 'all',
};

export function agruparParaSeleccion(
  servicios: Servicio[],
  categorias: CategoriaServicio[],
  excluidos: ExcluidosHistoria
): GrupoSeleccion[] {
  return agruparServiciosPorCategoria(servicios, categorias).map(grupo => {
    const ids = grupo.servicios.map(s => s.id);
    const incluidos = ids.filter(id => !excluidos.has(id));
    return {
      ...grupo,
      marcados: incluidos.length,
      total: ids.length,
      estado: ESTADO[deriveEstadoCategoria(ids, incluidos)],
    };
  });
}

export function toggleServicio(excluidos: ExcluidosHistoria, id: number): Set<number> {
  const next = new Set(excluidos);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

// Mismo criterio que el checkbox tri-state del resto de la app: todo marcado
// -> desmarca la categoría; parcial o vacío -> la marca entera.
export function toggleCategoria(excluidos: ExcluidosHistoria, ids: number[], estado: EstadoSeleccion): Set<number> {
  const next = new Set(excluidos);
  for (const id of ids) {
    if (estado === 'all') next.add(id); else next.delete(id);
  }
  return next;
}

export const seleccionarTodo = (): Set<number> => new Set();

export const quitarTodo = (servicios: Servicio[]): Set<number> => new Set(servicios.map(s => s.id));

export const filtrarPorSeleccion = (servicios: Servicio[], excluidos: ExcluidosHistoria): Servicio[] =>
  servicios.filter(s => !excluidos.has(s.id));

export const contarSeleccionados = (servicios: Servicio[], excluidos: ExcluidosHistoria): number =>
  filtrarPorSeleccion(servicios, excluidos).length;

// Puente con ServiciosSheet, que trabaja con ids SELECCIONADOS donde [] = todos.
// Sin excluidos (o ninguno disponible) -> [] ("todos"); si no, los disponibles
// que no están excluidos.
export const idsSeleccionadosDesdeExcluidos = (disponibles: Servicio[], excluidos: ExcluidosHistoria): number[] =>
  disponibles.some(s => excluidos.has(s.id))
    ? filtrarPorSeleccion(disponibles, excluidos).map(s => s.id)
    : [];

// Inverso: [] = todos (nada excluido); si no, se excluye todo lo disponible que
// no se eligió. Consecuencia: "ninguno" no es representable (vacío = todos).
export const excluidosDesdeSeleccionados = (disponibles: Servicio[], ids: number[]): Set<number> =>
  ids.length === 0
    ? new Set()
    : new Set(disponibles.filter(s => !ids.includes(s.id)).map(s => s.id));
