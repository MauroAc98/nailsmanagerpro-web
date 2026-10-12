// Helpers puros del encabezado A2 de la historia de turnos con servicios
// elegidos (ver StoryCanvas, prop `filtroServicios`).

// Bajada de servicios de StoryCanvas: 9px, peso 600, mayúsculas y 1.3px de
// espaciado por letra. El separador "·" viaja con el servicio siguiente
// (" ·  ": espacio, punto y dos espacios duros).
export const FUENTE_LINEA_SERVICIOS = '600 9px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const ESPACIADO_LINEA_SERVICIOS = 1.3;
const SEPARADOR = ' ·  ';

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

// Reparto voraz en líneas: un nombre nunca se parte; el separador cuenta
// entre dos nombres de la misma línea.
// Devuelve Infinity si un nombre solo ya no entra en el ancho.
export function contarLineasServicios(
  nombres: string[],
  anchoDisponible: number,
  medir: (texto: string) => number,
): number {
  if (nombres.length === 0) return 0;
  const sep = medir(SEPARADOR);
  let lineas = 1;
  let usado = 0;
  for (const nombre of nombres) {
    const w = medir(nombre);
    if (w > anchoDisponible) return Infinity;
    if (usado === 0) {
      usado = w;
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
): boolean {
  return contarLineasServicios(nombres, anchoDisponible, medir) <= maxLineas;
}

// Hasta 2 renglones en cualquier modo. En una quincena el alto extra lo
// devuelven el margen y los espacios entre filas (ver StoryCanvas).
export const MAX_LINEAS_SERVICIOS = 2;

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
  const mayus = texto.toUpperCase();
  const base = ctx ? ctx.measureText(mayus).width : mayus.length * 6;
  return base + mayus.length * ESPACIADO_LINEA_SERVICIOS;
}
