import type { Paso } from './pasoMinimo';
import { esHostReservaPublica } from './host';

// Rutas del flujo publico (decision D1: la URL es el paso).
export const rutaPaso = (slug: string, paso?: Paso): string =>
  paso ? `/reservar/${slug}/${paso}` : `/reservar/${slug}`;

export const rutaServicio = (slug: string, id: number): string => `/reservar/${slug}/servicio/${id}`;

export const rutaReserva = (slug: string, id: string): string => `/reservar/${slug}/reserva/${id}`;

// Antes de un `router.push` real, en reservar.turnetto.com hay que sacar el
// prefijo /reservar de la ruta absoluta de arriba: ese prefijo existe para
// que la MISMA ruta funcione en app.turnetto.com, pero en el dominio propio
// el rewrite server-side (middleware.ts) ya lo agrega por dentro en CADA
// navegacion real — empujarlo tal cual duplica el prefijo (/reservar/
// reservar/..., 404). Bug real visto en prod al tocar "Reservar turno".
export function rutaExterna(ruta: string, hostname: string): string {
  if (!esHostReservaPublica(hostname)) return ruta;
  return ruta.replace(/^\/reservar(?=\/|$)/, '') || '/';
}
