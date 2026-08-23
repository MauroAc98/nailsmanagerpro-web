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

// pathname === '/admin' o pathname empieza con '/admin/' — NO
// pathname.startsWith('/admin') a secas, que matchea por texto y agarra
// también /admin-manifest.json, /admin-icon-192.png, etc. (que no son
// rutas bajo /admin, son archivos hermanos con ese prefijo). Ese bug real
// tumbaba el rewrite del manifest: el fetch interno de Next para resolver
// ADMIN_ASSET_MAP pasa DE NUEVO por este middleware, y con el chequeo
// suelto terminaba bloqueado por la regla de host de abajo.
function esRutaAdmin(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // El panel admin vive SOLO en admin.turnetto.com — en cualquier otro
  // host (app.turnetto.com incluido) /admin/* no debe responder más.
  if (host !== ADMIN_HOST) {
    if (esRutaAdmin(pathname)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // request.nextUrl.protocol refleja X-Forwarded-Proto (https, seteado por
  // nginx) — pero el proxy interno de Next para un rewrite hace un fetch
  // real a ese origin, y el proceso Node solo escucha HTTP plano en :3000
  // (nginx termina TLS). Sin forzar 'http:' acá, ese fetch interno intenta
  // TLS contra un puerto HTTP y tira EPROTO/"wrong version number".
  const assetPath = ADMIN_ASSET_MAP[pathname];
  if (assetPath) {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = assetPath;
    return NextResponse.rewrite(url);
  }

  if (!esRutaAdmin(pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
