export type EstadoCategoria = 'checked' | 'unchecked' | 'indeterminate';

// Estado derivado del checkbox de categoría — nunca persistido, se
// recalcula en cada render a partir de los ids ACTIVOS de la categoría
// (`activosDeCategoria`) contra el set de ids seleccionados del
// profesional (`selectedIds`). Los ids inactivos de esa misma categoría
// NUNCA deben pasarse en `activosDeCategoria`: el caller (el componente del
// picker) es responsable de filtrar por `activo` antes de llamar a esta
// función, para que un servicio inactivo ya asignado no afecte el cálculo
// (ver spec: "Category Checkbox Tri-State Representation").
//
// Una categoría sin servicios activos (`activosDeCategoria` vacío) no
// tiene nada que marcar como seleccionado, así que se considera
// 'unchecked' — este caso no debería renderizarse con checkbox en la
// práctica (un grupo vacío no se genera, ver `agruparServiciosPorCategoria`),
// pero la función se mantiene total para no asumir ese invariante.
export function deriveEstadoCategoria(activosDeCategoria: number[], selectedIds: number[]): EstadoCategoria {
  if (activosDeCategoria.length === 0) return 'unchecked';

  const seleccionados = new Set(selectedIds);
  const cantidadSeleccionada = activosDeCategoria.filter(id => seleccionados.has(id)).length;

  if (cantidadSeleccionada === 0) return 'unchecked';
  if (cantidadSeleccionada === activosDeCategoria.length) return 'checked';
  return 'indeterminate';
}
