import { CATEGORIAS_GASTO } from '@/services/gastoService';
import { CATEGORIAS_INGRESO } from '@/services/ingresoService';

// ─────────────────────────────────────────────
// Label de una categoría de movimiento (gasto o ingreso).
//
// Desde que el salón puede definir sus propias categorías (PR "categorías
// personalizadas"), `gasto.categoria` / `ingreso.categoria` es texto libre:
// puede ser una de las categorías de fábrica (CATEGORIAS_GASTO /
// CATEGORIAS_INGRESO) o un nombre custom que la usuaria escribió.
//
// - Categoría de fábrica  -> se traduce con la key `category_<slug>` del
//   catálogo correspondiente (`configuracion.GastosPage` /
//   `configuracion.IngresosPage`).
// - Categoría custom      -> se muestra tal cual (no hay key i18n para ella).
//
// La función `t` se recibe por parámetro: todos los call sites son
// componentes que ya tienen su `useTranslations(...)` del namespace
// correcto, así que pasarla es más limpio que acoplar este helper al
// locale store (como sí hace `lib/turnoValidaciones.ts` con `tStatic`,
// que corre fuera de React).
// ─────────────────────────────────────────────

type Traductor = (key: string) => string;

const SET_GASTO: ReadonlySet<string> = new Set(CATEGORIAS_GASTO);
const SET_INGRESO: ReadonlySet<string> = new Set(CATEGORIAS_INGRESO);

export function labelCategoriaGasto(categoria: string, t: Traductor): string {
  return SET_GASTO.has(categoria) ? t(`category_${categoria}`) : categoria;
}

export function labelCategoriaIngreso(categoria: string, t: Traductor): string {
  return SET_INGRESO.has(categoria) ? t(`category_${categoria}`) : categoria;
}
