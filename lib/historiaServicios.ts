// Helpers puros del encabezado A2 de la historia de turnos con servicios
// elegidos (ver StoryCanvas, prop `filtroServicios`).

// Bajada de servicios de StoryCanvas: serif cursiva de 11px, tal cual se
// escribe el nombre (sin mayúsculas ni espaciado). El separador es un rombo
// chico dibujado (no un "·" de texto, que queda bajo y desparejo en cursiva y
// se confunde con el de las horas): ocupa un ancho fijo, 4px de rombo más 6px
// de aire a cada lado, y viaja con el servicio siguiente.
export const TAMANO_LINEA_SERVICIOS = 11;
export const ANCHO_SEPARADOR_SERVICIOS = 16;
const FUENTE_RESPALDO = 'Georgia, serif';
// Playfair es más ancha que Georgia: el margen evita que el aviso diga "entra"
// y la imagen se corte.
const MARGEN_MEDIDA = 1.03;

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

// Reparto voraz en renglones: un nombre nunca se parte y el separador solo
// cuenta (y se dibuja) entre nombres del mismo renglón. StoryCanvas dibuja
// estos mismos renglones, así la imagen y el aviso de la hoja coinciden.
export function repartirEnRenglones(
  nombres: string[],
  anchoDisponible: number,
  medir: (texto: string) => number,
): string[][] {
  const sep = ANCHO_SEPARADOR_SERVICIOS;
  const renglones: string[][] = [];
  let usado = 0;
  for (const nombre of nombres) {
    const w = medir(nombre);
    const actual = renglones[renglones.length - 1];
    if (actual && usado + sep + w <= anchoDisponible) {
      actual.push(nombre);
      usado += sep + w;
    } else {
      renglones.push([nombre]);
      usado = w;
    }
  }
  return renglones;
}

// Devuelve Infinity si un nombre solo ya no entra en el ancho.
export function contarLineasServicios(
  nombres: string[],
  anchoDisponible: number,
  medir: (texto: string) => number,
): number {
  if (nombres.some(n => medir(n) > anchoDisponible)) return Infinity;
  return repartirEnRenglones(nombres, anchoDisponible, medir).length;
}

export function serviciosEntran(
  nombres: string[],
  maxLineas: number,
  anchoDisponible: number,
  medir: (texto: string) => number,
): boolean {
  return contarLineasServicios(nombres, anchoDisponible, medir) <= maxLineas;
}

// Hasta 3 renglones en cualquier modo (cabe la categoría con más servicios).
// En una quincena el alto extra lo devuelven el margen y los espacios entre
// filas (ver StoryCanvas).
export const MAX_LINEAS_SERVICIOS = 3;

let ctx: CanvasRenderingContext2D | null | undefined;

// El canvas 2D no entiende var(--font-agenda-serif): se lee el nombre real de
// la familia que next/font dejó en <html>.
function fuenteLineaServicios(): string {
  const familia = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--font-agenda-serif').trim()
    : '';
  return `italic 400 ${TAMANO_LINEA_SERVICIOS}px ${familia ? `${familia}, ` : ''}${FUENTE_RESPALDO}`;
}

export function medirTextoServicios(texto: string): number {
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
    if (ctx) ctx.font = fuenteLineaServicios();
  }
  const base = ctx ? ctx.measureText(texto).width : texto.length * 5.5;
  return base * MARGEN_MEDIDA;
}
