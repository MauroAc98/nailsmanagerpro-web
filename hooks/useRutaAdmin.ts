'use client';

import { usePathname } from 'next/navigation';
import { tienePrefijoAdmin } from '@/lib/esPanelAdmin';

// Los links del panel se escriben con la URL limpia de admin.turnetto.com
// ("/uso", "/suscripciones"). Fuera de ese host (localhost, app.turnetto.com)
// no hay reescritura y el panel vive bajo /admin: sin el prefijo el link cae en
// la guarda del salón y manda al login del salón. Mismo criterio que usa el
// layout del panel para decidir su home y su login.
export function useRutaAdmin(): (ruta: string) => string {
  const prefijo = tienePrefijoAdmin(usePathname()) ? '/admin' : '';
  return (ruta: string) => (ruta === '/' ? prefijo || '/' : `${prefijo}${ruta}`);
}
