interface Medidas {
  // getBoundingClientRect().bottom del canvas y .top de la línea divisoria.
  bottomRaiz: number;
  topLinea: number;
  // Alto con el que se ve el canvas en pantalla vs. el alto lógico (canvasHeight),
  // para corregir cualquier escala del contenedor.
  alturaRenderizada: number;
  alturaCanvas: number;
}

// Alto de la franja desenfocada del pie: desde la línea divisoria hasta el
// borde inferior del canvas. La línea se mueve con el contenido del pie, así
// que la franja se mide en vez de ser un alto fijo. null si todavía no hay
// layout real (alto 0) o las medidas no son coherentes.
export function zonaPieDesdeLinea({ bottomRaiz, topLinea, alturaRenderizada, alturaCanvas }: Medidas): number | null {
  if (alturaRenderizada <= 0 || alturaCanvas <= 0) return null;
  const escala = alturaRenderizada / alturaCanvas;
  const alto = (bottomRaiz - topLinea) / escala;
  if (!Number.isFinite(alto) || alto <= 0) return null;
  return Math.round(alto);
}
