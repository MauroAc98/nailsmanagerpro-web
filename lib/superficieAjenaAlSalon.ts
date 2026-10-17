import { PRO_HOST, esHostInterno, normalizarHost, tienePrefijoPro } from './hosts';
import { esPanelAdmin } from './esPanelAdmin';

// ¿Esta pantalla NO es del salón? El guard del salón (app/providers.tsx) corta
// ahí su arranque, su re-enlace de push, su bienvenida y sus redirecciones.
//
// Cubre solo el panel de admin y el portal de profesionales. La reserva pública
// NO entra: Providers la sigue tratando con su propia condición, porque ahí el
// arranque de la sesión del salón y el refresco del negocio siguen corriendo.
//
// - Portal: profesionales.turnetto.com manda siempre por host (sirve URLs
//   limpias, el middleware las reescribe a /pro/*).
// - El prefijo /pro solo vale donde no hay reescritura: sin host (servidor) o
//   en un host interno (localhost, dev). En app.turnetto.com u otro host
//   externo /pro/... NO se exime: el middleware ya lo responde 404, esto es
//   defensa en profundidad para que el guard del salón no lo trate como portal.
//
// `hostname` es null donde no hay window (renderizado en servidor).
export function esSuperficieAjenaAlSalon(hostname: string | null, pathname: string): boolean {
  if (esPanelAdmin(hostname, pathname)) return true;
  if (normalizarHost(hostname) === PRO_HOST) return true;
  return tienePrefijoPro(pathname) && (hostname === null || esHostInterno(hostname));
}
