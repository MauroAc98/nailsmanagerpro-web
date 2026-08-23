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
const APP_HOST = 'app.turnetto.com';

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

  // El panel admin vive SOLO en admin.turnetto.com — en app.turnetto.com
  // (el tenant) /admin/* no debe responder más. Ojo: esto compara contra
  // APP_HOST puntual, NO "cualquier host que no sea ADMIN_HOST" — el
  // rewrite de abajo hace que Next resuelva /login internamente con un
  // fetch a http://localhost:3000/admin/login, y ESE fetch interno vuelve
  // a pasar por este middleware con Host: localhost:3000. Bloquear ahí
  // también tumbaba el rewrite entero (bug real, visto en prod: admin.
  // turnetto.com/login daba 404 hasta este fix).
  if (host === APP_HOST) {
    if (esRutaAdmin(pathname)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (host !== ADMIN_HOST) {
    // Ni admin.turnetto.com ni app.turnetto.com — incluye el fetch interno
    // de Next resolviendo su propio rewrite (Host: localhost:3000). Dejar
    // pasar sin tocar.
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

  // URL visible en admin.turnetto.com sin el prefijo /admin (ej. /login,
  // no /admin/login) — la ruta real en disco sigue bajo app/(admin)/admin/*
  // (necesario para no chocar con el /login del tenant en app.turnetto.com,
  // mismo código fuente). El rewrite mapea /login → /admin/login puertas
  // adentro; usePathname() en los componentes admin sigue viendo el path
  // LIMPIO (Next no expone el rewrite al cliente), por eso layout.tsx y los
  // Link/router.push del panel usan las rutas limpias, no /admin/*.
  if (!esRutaAdmin(pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Alguien pidió la ruta vieja con el prefijo (admin.turnetto.com/admin,
  // /admin/login) directo, sin pasar por el rewrite de arriba — no debe
  // responder, solo existe la versión limpia (/, /login). Esto NO afecta
  // el fetch interno de Next para resolver ese rewrite: ese llega con
  // Host: localhost:3000, no ADMIN_HOST, así que nunca llega hasta acá
  // (vuelve en el branch de la línea 52).
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
