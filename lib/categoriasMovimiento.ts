// ─────────────────────────────────────────────
// Lógica pura de la edición de la lista de categorías de movimientos
// (gastos / ingresos), separada de la pantalla para poder testearla sin
// React. Espeja las reglas del backend (`PUT /perfil`): 1..30 ítems, cada
// string 1..40 chars, sin repetir; el backend normaliza trim + espacios
// interiores antes de comparar, así que acá hacemos lo mismo para avisar
// ANTES de mandar el request.
// ─────────────────────────────────────────────

export const MAX_CATEGORIAS = 30;
export const MAX_LARGO_CATEGORIA = 40;

export type ErrorCategoria = 'vacia' | 'duplicada' | 'muyLarga' | 'limite' | 'minima';

export type ResultadoCategorias =
  | { ok: true; categorias: string[] }
  | { ok: false; error: ErrorCategoria };

// Recorta extremos y colapsa cualquier secuencia de espacios interiores en
// uno solo — misma normalización que aplica el backend.
export function normalizarCategoria(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

// Comparación sin distinción de mayúsculas: "Insumos" e "insumos" son la
// misma categoría a los fines de detectar duplicados.
function yaExiste(lista: readonly string[], valor: string, exceptoIndex?: number): boolean {
  const objetivo = valor.toLowerCase();
  return lista.some((c, i) => i !== exceptoIndex && c.toLowerCase() === objetivo);
}

export function agregarCategoria(lista: readonly string[], valorCrudo: string): ResultadoCategorias {
  const valor = normalizarCategoria(valorCrudo);
  if (!valor) return { ok: false, error: 'vacia' };
  if (valor.length > MAX_LARGO_CATEGORIA) return { ok: false, error: 'muyLarga' };
  if (lista.length >= MAX_CATEGORIAS) return { ok: false, error: 'limite' };
  if (yaExiste(lista, valor)) return { ok: false, error: 'duplicada' };
  return { ok: true, categorias: [...lista, valor] };
}

export function renombrarCategoria(
  lista: readonly string[],
  index: number,
  valorCrudo: string,
): ResultadoCategorias {
  const valor = normalizarCategoria(valorCrudo);
  if (!valor) return { ok: false, error: 'vacia' };
  if (valor.length > MAX_LARGO_CATEGORIA) return { ok: false, error: 'muyLarga' };
  if (yaExiste(lista, valor, index)) return { ok: false, error: 'duplicada' };
  return { ok: true, categorias: lista.map((c, i) => (i === index ? valor : c)) };
}

export function eliminarCategoria(lista: readonly string[], index: number): ResultadoCategorias {
  if (lista.length <= 1) return { ok: false, error: 'minima' };
  return { ok: true, categorias: lista.filter((_, i) => i !== index) };
}

// Igualdad de listas para el "hay cambios sin guardar" — orden incluido.
export function categoriasIguales(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
