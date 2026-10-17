import { tienePrefijoPro } from '@/lib/hosts';

// En profesionales.turnetto.com usePathname() devuelve la ruta limpia
// ("/agenda"); en localhost vive bajo /pro ("/pro/agenda"). Las reglas del
// portal se escriben siempre sobre la ruta limpia.
export function rutaLimpiaPro(pathname: string): string {
  if (!tienePrefijoPro(pathname)) return pathname;
  return pathname.slice('/pro'.length) || '/';
}

// Convierte una ruta limpia a la que corresponde navegar desde el pathname
// actual: agrega /pro solo si el pathname actual ya lo trae (localhost).
export function conPrefijoPro(ruta: string, pathnameActual: string): string {
  if (!tienePrefijoPro(pathnameActual)) return ruta;
  return ruta === '/' ? '/pro' : `/pro${ruta}`;
}
