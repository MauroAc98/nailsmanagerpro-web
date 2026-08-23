import { NextRequest, NextResponse } from 'next/server';

// admin.turnetto.com es el mismo build que app.turnetto.com (mismo proceso
// PM2, mismo puerto en nginx — ver nginx sites-available/admin-turnetto),
// separado solo por Host. Dos cosas distintas acá:
// 1. Cualquier ruta que no sea /admin cae en /admin (si no, entrar a "/"
//    termina en app/page.tsx → redirect a /login, el login de tenant).
// 2. manifest/ícono se reescriben a los archivos propios de admin — a
//    nivel de red, no en app/layout.tsx, a propósito: leer el Host ahí
//    (generateMetadata con next/headers) vuelve TODA la app dinámica
//    (pierde el prerenderizado estático de cada ruta). Reescribir acá
//    mantiene el HTML 100% estático y solo cambia qué archivo responde.
const ADMIN_HOST = 'admin.turnetto.com';

const ADMIN_ASSET_MAP: Record<string, string> = {
  '/manifest.json': '/admin-manifest.json',
  '/icon-192.png': '/admin-icon-192.png',
  '/icon-512.png': '/admin-icon-512.png',
};

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (host !== ADMIN_HOST) return NextResponse.next();

  const { pathname } = request.nextUrl;

  const assetPath = ADMIN_ASSET_MAP[pathname];
  if (assetPath) {
    const url = request.nextUrl.clone();
    url.pathname = assetPath;
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
