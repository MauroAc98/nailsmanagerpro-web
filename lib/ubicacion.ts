// Coordenadas de la ubicación del salón (Slice A del mapa de WhatsApp).
// Mirrors the backend range check (`AuthController::updatePerfil`:
// `between:-90,90` / `between:-180,180`, both-or-neither).

/** Centro de mapa por defecto cuando no hay coordenadas guardadas ni geocode
 * resuelto: Corrientes, Argentina — ver design D5 (centering priority). */
export const CENTRO_FALLBACK = { lat: -27.4692, lng: -58.8306, zoom: 13 } as const;

/**
 * Valida un par de coordenadas: ambas deben estar presentes (no null) y
 * dentro de rango. Espeja el guard del backend, que exige el par completo o
 * ninguno — acá solo valida el shape, no decide si el par debe enviarse.
 */
export function esUbicacionValida(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
