'use client';

import { usePathname } from 'next/navigation';
import { conPrefijoPro } from '@/lib/pro/rutas';

// Los links del portal se escriben con la URL limpia de
// profesionales.turnetto.com ("/agenda", "/cuenta"). En localhost no hay
// reescritura y el portal vive bajo /pro: sin el prefijo el link cae fuera del
// portal. Mismo criterio que useRutaAdmin.
export function useRutaPro(): (ruta: string) => string {
  const pathname = usePathname();
  return (ruta: string) => conPrefijoPro(ruta, pathname);
}
