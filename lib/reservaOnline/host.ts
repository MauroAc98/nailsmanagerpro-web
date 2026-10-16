import { RESERVAR_HOST, normalizarHost } from '../hosts';

// Dominio propio de la reserva pública (reservar.turnetto.com): el mismo
// proceso Next que app.turnetto.com, servido con URLs limpias sin el
// prefijo /reservar (ver middleware.ts, que hace el rewrite server-side en
// la PRIMERA carga). El hostname vive en lib/hosts.ts; lo consumen tanto la
// navegación del flujo (useIr, más abajo) como el guard de auth global
// (app/providers.tsx), que nunca debe gatear ni redirigir en este dominio.
export const RESERVA_PUBLICA_HOST = RESERVAR_HOST;

export function esHostReservaPublica(hostname: string): boolean {
  return normalizarHost(hostname) === RESERVAR_HOST;
}
