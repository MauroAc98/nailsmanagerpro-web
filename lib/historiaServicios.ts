// Helpers puros del encabezado A2 de la historia de turnos con servicios
// elegidos (ver StoryCanvas, prop `filtroServicios`).

export const FUENTE_LINEA_SERVICIOS = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SEPARADOR = ' · ';

export function tituloFiltroServicios(
  servicios: { categoria_id: number | null }[],
  categorias: { id: number; nombre: string }[],
  textos: { fallback: string; y: string } = { fallback: 'Servicios', y: 'y' },
): string {
  const usadas = new Set<number>();
  for (const s of servicios) if (s.categoria_id !== null) usadas.add(s.categoria_id);
  const nombres = categorias.filter(c => usadas.has(c.id)).map(c => c.nombre);
  if (nombres.length === 0) return textos.fallback;
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} ${textos.y} ${nombres[nombres.length - 1]}`;
}

// Reparto voraz en líneas: un nombre nunca se parte; el separador " / " cuenta
// entre dos nombres de la misma línea.
// Devuelve Infinity si un nombre solo ya no entra en el ancho.
export function contarLineasServicios(
  nombres: string[],
  anchoDisponible: number,
  medir: (texto: string) => number,
  // Ancho ya ocupado al principio del primer renglón (la etiqueta de la
  // categoría, con su separación).
  anchoInicial = 0,
): number {
  if (nombres.length === 0) return 0;
  const sep = medir(SEPARADOR);
  let lineas = 1;
  let usado = anchoInicial;
  let hayNombre = false;
  for (const nombre of nombres) {
    const w = medir(nombre);
    if (w > anchoDisponible) return Infinity;
    if (!hayNombre) {
      hayNombre = true;
      if (usado + w <= anchoDisponible) {
        usado += w;
      } else {
        lineas += 1;
        usado = w;
      }
    } else if (usado + sep + w <= anchoDisponible) {
      usado += sep + w;
    } else {
      lineas += 1;
      usado = w;
    }
  }
  return lineas;
}

export function serviciosEntran(
  nombres: string[],
  maxLineas: number,
  anchoDisponible: number,
  medir: (texto: string) => number,
  anchoInicial = 0,
): boolean {
  return contarLineasServicios(nombres, anchoDisponible, medir, anchoInicial) <= maxLineas;
}

// Hasta 2 renglones en cualquier modo. En una quincena el alto extra lo
// devuelven el margen y los espacios entre filas (ver StoryCanvas).
export const MAX_LINEAS_SERVICIOS = 2;

// Etiqueta de la categoría delante de los servicios (StoryCanvas): 9px,
// peso 800, mayúsculas, 1.4px de espaciado, 8px de relleno por lado y 8px de
// separación con el primer servicio.
export const FUENTE_ETIQUETA_CATEGORIA = '800 9px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ESPACIADO_ETIQUETA = 1.4;
const EXTRA_ETIQUETA = 8 * 2 + 8;

let ctxEtiqueta: CanvasRenderingContext2D | null | undefined;

export function medirEtiquetaCategoria(texto: string): number {
  const mayus = texto.toUpperCase();
  if (ctxEtiqueta === undefined) {
    try {
      ctxEtiqueta = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctxEtiqueta = null;
    }
    if (ctxEtiqueta) ctxEtiqueta.font = FUENTE_ETIQUETA_CATEGORIA;
  }
  const texto9 = ctxEtiqueta ? ctxEtiqueta.measureText(mayus).width : mayus.length * 6.5;
  return texto9 + mayus.length * ESPACIADO_ETIQUETA + EXTRA_ETIQUETA;
}

let ctx: CanvasRenderingContext2D | null | undefined;

export function medirTextoServicios(texto: string): number {
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
    if (ctx) ctx.font = FUENTE_LINEA_SERVICIOS;
  }
  if (!ctx) return texto.length * 6;
  return ctx.measureText(texto).width;
}
