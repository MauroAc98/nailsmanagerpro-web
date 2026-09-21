// Caches de next-pwa donde el service worker pudo guardar respuestas GET con
// datos de la sesion (clientes, turnos, gastos). La API vive en otro origen,
// asi que las reglas por defecto la metian en 'cross-origin' (NetworkFirst, 1h);
// 'apis' y 'others' cubren los GET del mismo origen. Cache Storage no se vacia
// solo al cerrar sesion: en un celular compartido la persona siguiente podia
// ver datos de la anterior si fallaba la red.
export const CACHES_CON_DATOS_DE_SESION = ['cross-origin', 'apis', 'others'];

// Nunca lanza: limpiar caches no puede romper el logout ni el manejo del 401.
export async function limpiarCachesDeSesion(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const existentes = await caches.keys();
    await Promise.all(
      existentes
        .filter((nombre) => CACHES_CON_DATOS_DE_SESION.includes(nombre))
        .map((nombre) => caches.delete(nombre)),
    );
  } catch {
    // sin acceso a Cache Storage: nada que limpiar
  }
}
