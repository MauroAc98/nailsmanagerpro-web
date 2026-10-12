// Formato fijo de la historia de turnos: se dibuja SIEMPRE a 360 x 640 (9:16
// exacto, un tercio de 1080 x 1920) sin importar el celular, y se exporta x3.
// Antes se dibujaba al 85% del ancho de la pantalla: con fuentes y filas de
// tamaño fijo, en un celular chico el contenido no entraba y el pie terminaba
// debajo de la zona segura (tapado por la barra de Instagram/WhatsApp).
export const HISTORIA_ANCHO = 360;
export const HISTORIA_ALTO = 640;
export const HISTORIA_EXPORT_ANCHO = 1080;
export const PIXEL_RATIO_EXPORT = HISTORIA_EXPORT_ANCHO / HISTORIA_ANCHO;

const ANCHO_VISTA_MAX = 420;
const PROPORCION_PANTALLA = 0.85;

// Escala con la que se muestra la historia en pantalla (solo la vista previa;
// el nodo que se exporta mide siempre HISTORIA_ANCHO x HISTORIA_ALTO).
export function escalaVistaPrevia(anchoPantalla: number): number {
  if (!(anchoPantalla > 0)) return 1;
  return Math.min(ANCHO_VISTA_MAX, anchoPantalla * PROPORCION_PANTALLA) / HISTORIA_ANCHO;
}
