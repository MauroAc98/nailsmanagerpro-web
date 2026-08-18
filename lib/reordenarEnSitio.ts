// Reordena `items` sin moverlos fuera de las posiciones que ya ocupan: se
// recorre el array en su orden actual y, en cada posición cuyo id está en
// `newOrder`, se sustituye por el siguiente id de `newOrder` (en secuencia).
// Así el resultado nunca reagrupa entre sí ids afectados y no afectados —
// necesario porque `newOrder` puede ser solo UN subconjunto (ej. un grupo de
// servicios regular/promo, o las fotos de un solo profesional) y el resto de
// consumidores dependen únicamente del orden relativo dentro de su propio
// subconjunto, nunca de un intercalado entre grupos.
export function reordenarEnSitio<T extends { id: number }>(items: T[], newOrder: number[]): T[] {
  const afectados = new Set(newOrder);
  const porId = new Map(items.map(item => [item.id, item]));
  let cursor = 0;
  return items.map(item => {
    if (!afectados.has(item.id)) return item;
    const siguienteId = newOrder[cursor++];
    return porId.get(siguienteId) ?? item;
  });
}
