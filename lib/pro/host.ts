import { PRO_HOST, normalizarHost, tienePrefijoPro } from '@/lib/hosts';

// ¿Esta pantalla es del portal de profesionales?
//
// - profesionales.turnetto.com sirve el portal con URLs limpias (/login,
//   /agenda); el middleware las reescribe por dentro a /pro/*, así que ahí
//   manda el host.
// - En localhost (dev) no hay reescritura: las páginas viven bajo /pro y manda
//   el prefijo de la ruta.
//
// `hostname` es null donde no hay window (renderizado en servidor): ahí solo
// decide el prefijo de la ruta.
export function esPortalProfesionales(hostname: string | null, pathname: string): boolean {
  return normalizarHost(hostname) === PRO_HOST || tienePrefijoPro(pathname);
}
