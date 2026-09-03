import { Gasto, CategoriaGasto } from '@/services/gastoService';

// ─────────────────────────────────────────────
// Filtrado client-side de la lista de gastos que ya trajo el store para el
// mes navegado (GET /gastos?desde&hasta). El backend solo filtra por rango
// de fecha; categoría, texto y profesional se resuelven acá en memoria —
// el dataset de un mes es chico, no vale un round-trip por cada ajuste.
// ─────────────────────────────────────────────

export interface FiltrosGasto {
  categoria: CategoriaGasto | null;
  texto: string;
  profesionalId: number | null;
  desde: string | null; // "YYYY-MM-DD" — inclusive
  hasta: string | null; // "YYYY-MM-DD" — inclusive
}

export const FILTROS_GASTO_VACIOS: FiltrosGasto = {
  categoria: null,
  texto: '',
  profesionalId: null,
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
export function contarFiltrosActivos(f: FiltrosGasto): number {
  let n = 0;
  if (f.categoria) n += 1;
  if (f.texto.trim()) n += 1;
  if (f.profesionalId != null) n += 1;
  if (f.desde || f.hasta) n += 1;
  return n;
}

export function filtrarGastos(gastos: Gasto[], f: FiltrosGasto): Gasto[] {
  const texto = normalizar(f.texto);

  return gastos.filter(g => {
    if (f.categoria && g.categoria !== f.categoria) return false;
    if (f.profesionalId != null && g.profesional_id !== f.profesionalId) return false;
    // "YYYY-MM-DD" — el orden lexicográfico coincide con el cronológico,
    // así que se comparan como strings sin parsear a Date.
    if (f.desde && g.fecha < f.desde) return false;
    if (f.hasta && g.fecha > f.hasta) return false;
    if (texto && !normalizar(g.descripcion ?? '').includes(texto)) return false;
    return true;
  });
}
