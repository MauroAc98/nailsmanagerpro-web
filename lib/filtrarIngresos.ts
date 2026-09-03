import { Ingreso, CategoriaIngreso } from '@/services/ingresoService';

// ─────────────────────────────────────────────
// Filtrado client-side de la lista de ingresos que ya trajo el store para
// el mes navegado (GET /ingresos?desde&hasta). El backend solo filtra por
// rango de fecha; categoría y texto se resuelven acá en memoria — el
// dataset de un mes es chico, no vale un round-trip por cada ajuste.
// Espejo de lib/filtrarGastos.ts SIN la dimensión de profesional: un
// ingreso no tiene profesional_id.
// ─────────────────────────────────────────────

export interface FiltrosIngreso {
  categoria: CategoriaIngreso | null;
  texto: string;
  desde: string | null; // "YYYY-MM-DD" — inclusive
  hasta: string | null; // "YYYY-MM-DD" — inclusive
}

export const FILTROS_INGRESO_VACIOS: FiltrosIngreso = {
  categoria: null,
  texto: '',
  desde: null,
  hasta: null,
};

// Ignora acentos y mayúsculas ("algodon" matchea "Algodón"), mismo criterio
// que la búsqueda de clientes en agenda/[id]/page.tsx.
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Cuántas dimensiones están activas — para el badge del botón "Filtros" y
// para decidir si mostrar el botón "Limpiar". `desde`/`hasta` cuentan como
// una sola (son un único rango en la UI).
export function contarFiltrosActivos(f: FiltrosIngreso): number {
  let n = 0;
  if (f.categoria) n += 1;
  if (f.texto.trim()) n += 1;
  if (f.desde || f.hasta) n += 1;
  return n;
}

export function filtrarIngresos(ingresos: Ingreso[], f: FiltrosIngreso): Ingreso[] {
  const texto = normalizar(f.texto);

  return ingresos.filter(i => {
    if (f.categoria && i.categoria !== f.categoria) return false;
    // "YYYY-MM-DD" — el orden lexicográfico coincide con el cronológico,
    // así que se comparan como strings sin parsear a Date.
    if (f.desde && i.fecha < f.desde) return false;
    if (f.hasta && i.fecha > f.hasta) return false;
    if (texto && !normalizar(i.descripcion ?? '').includes(texto)) return false;
    return true;
  });
}
