import { NextRequest, NextResponse } from 'next/server';

// admin.turnetto.com es el mismo build que app.turnetto.com (mismo proceso
// PM2, mismo puerto en nginx — ver nginx sites-available/admin-turnetto),
// separado solo por Host. Acá se resuelven tres cosas:
// 1. Las páginas del panel (rutas limpias, sin /admin) se reescriben a su
//    archivo real bajo app/(admin)/admin/* — necesario para no chocar con
//    el /login del tenant en app.turnetto.com, mismo código fuente.
// 2. manifest/ícono se reescriben a los archivos propios de admin.
// 3. Todo lo demás (assets estáticos de public/: splash/*, *.svg, etc.)
//    pasa SIN TOCAR. Bug real que costó ratos de debugging esta noche:
//    hasta esta versión, un catch-all reescribía CUALQUIER pathname no
//    reconocido con el prefijo /admin — incluidos archivos estáticos como
//    /splash/apple-splash-*.png o /admin-icon-192.png (pedido por su
//    nombre real, no vía ADMIN_ASSET_MAP). Eso los rompía con 404. El
//    service worker precachea TODOS los assets de public/ al instalar —
//    33 de 146 URLs 404eaban, y workbox aborta el install completo si
//    una sola falla, así que el service worker nunca terminaba de
//    instalar en admin.turnetto.com (quedaba en estado "redundant" en
//    silencio) aunque el registro en sí resolviera bien. Por eso ahora
//    el rewrite de páginas usa una lista explícita en vez de un
//    catch-all: solo las 5 páginas reales del panel se reescriben,
//    cualquier otra cosa (activo estático o no) se sirve tal cual.
const ADMIN_HOST = 'admin.turnetto.com';
const APP_HOST = 'app.turnetto.com';

const ADMIN_ASSET_MAP: Record<string, string> = {
  '/manifest.json': '/admin-manifest.json',
  '/icon-192.png': '/admin-icon-192.png',
  '/icon-512.png': '/admin-icon-512.png',
};

// Único lugar que define qué URLs limpias existen en el panel — si se
// agrega una página nueva bajo app/(admin)/admin/, sumarla acá también.
const ADMIN_PAGES = new Set([
  '/',
  '/login',
  '/negocios/nuevo',
  '/suscripciones',
  '/configuracion',
]);

// pathname === '/admin' o pathname empieza con '/admin/' — NO
// pathname.startsWith('/admin') a secas, que matchea por texto y agarra
// también /admin-manifest.json, /admin-icon-192.png, etc. (que no son
// rutas bajo /admin, son archivos hermanos con ese prefijo).
function esRutaAdminVieja(pathname: string): boolean {
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
  // turnetto.com/login daba 404 hasta ese fix).
  if (host === APP_HOST) {
    if (esRutaAdminVieja(pathname)) {
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

  if (ADMIN_PAGES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Ruta vieja con el prefijo directo (admin.turnetto.com/admin,
  // /admin/login) — no debe responder, solo existe la versión limpia.
  if (esRutaAdminVieja(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Cualquier otra cosa — assets de public/ (splash/*, sw.js, workbox-*,
  // *.svg, etc.), rutas de Next que no son del panel, lo que sea — se
  // sirve tal cual, sin prefijo. Ver comentario largo arriba del porqué.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
