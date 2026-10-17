import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_HOST,
  ADMIN_PAGES,
  APP_HOST,
  PRO_HOST,
  RESERVAR_HOST,
  esHostInterno,
  esRutaUso,
  normalizarHost,
  tienePrefijoPro,
} from './lib/hosts';

// admin.turnetto.com es el mismo build que app.turnetto.com (mismo proceso
// PM2, mismo puerto en nginx — ver nginx sites-available/admin-turnetto),
// separado solo por Host. Los hosts y la lista de páginas del panel viven en
// lib/hosts.ts (única fuente de verdad). Acá se resuelven estas cosas:
// 1. Las páginas del panel (rutas limpias, sin /admin) se reescriben a su
//    archivo real bajo app/(admin)/admin/* — necesario para no chocar con
//    el /login del tenant en app.turnetto.com, mismo código fuente.
// 2. manifest/ícono se reescriben a los archivos propios de admin.
// 3. Los assets estáticos de public/ (splash/*, sw.js, *.svg, etc.) pasan
//    SIN TOCAR. Bug real que costó ratos de debugging: un catch-all
//    reescribía CUALQUIER pathname no reconocido con el prefijo /admin —
//    incluidos archivos estáticos como /splash/apple-splash-*.png o
//    /admin-icon-192.png (pedido por su nombre real, no vía
//    ADMIN_ASSET_MAP). Eso los rompía con 404. El service worker precachea
//    TODOS los assets de public/ al instalar — 33 de 146 URLs 404eaban, y
//    workbox aborta el install completo si una sola falla, así que el
//    service worker nunca terminaba de instalar en admin.turnetto.com
//    (quedaba en estado "redundant" en silencio). Por eso el rewrite de
//    páginas usa una lista explícita en vez de un catch-all, y los
//    estáticos se detectan aparte (esArchivoEstatico).
// 4. Todo lo demás en el host admin responde 404: ese origen guarda el token
//    del panel en localStorage y NO debe servir también las pantallas del
//    tenant (/clientes, /login/{slug}, /reservar/*) — allowlist cerrada.

// reservar.turnetto.com — mismo proceso/build que app.turnetto.com (ver
// nginx sites-available/reservar-turnetto), separado solo por Host. A
// diferencia de admin (páginas puntuales), acá TODO el subárbol público de
// reserva vive bajo un único prefijo (app/reservar/[slug]/**), así que el
// rewrite es "agregar /reservar adelante" en vez de una lista de páginas.
// Los estáticos de public/ (manifest.json, sw.js, workbox-*.js, íconos,
// favicon) NUNCA deben llevar ese prefijo — mismo bug que el de admin
// (comentario grande arriba): se detectan por tener un '.' en el último
// segmento del path, igual que cualquier archivo real de public/.
function esArchivoEstatico(pathname: string): boolean {
  const ultimoSegmento = pathname.slice(pathname.lastIndexOf('/') + 1);
  return ultimoSegmento.includes('.');
}

const ADMIN_ASSET_MAP: Record<string, string> = {
  '/manifest.json': '/admin-manifest.json',
  '/icon-192.png': '/admin-icon-192.png',
  '/icon-512.png': '/admin-icon-512.png',
};

// profesionales.turnetto.com — mismo proceso/build que app.turnetto.com (ver
// lib/hosts.ts), separado solo por Host. Igual que reservar, todo el portal
// vive bajo un único prefijo (app/(profesionales)/pro/**): el rewrite es
// "agregar /pro adelante". Cualquier ruta que no sea del portal (/agenda del
// tenant, /configuracion, etc.) queda como /pro/<x>, que Next resuelve a 404
// porque no existe esa página — nunca sirve una pantalla del tenant. Este
// origen guarda el token del portal en localStorage, igual que admin.
//
// manifest/íconos se mapean a los archivos propios del portal (igual que
// admin); el resto de los estáticos de public/ pasan sin tocar.
//
// OJO: acá NO sirve esArchivoEstatico (un '.' en el último segmento). En este
// host un path como /agenda/1.x o /login/slug.x pasaría sin prefijo y Next
// resolvería la página dinámica del TENANT en el origen que guarda el token
// del portal. Solo pasan los archivos reales de public/: los de la raíz (un
// único segmento con '.') y los de splash/ (imágenes de arranque de iOS que
// linkea el layout raíz). Todo lo demás —con punto o sin él— se reescribe a /pro.
function esArchivoPublico(pathname: string): boolean {
  return (
    /^\/[^/]+\.[^/]+$/.test(pathname) ||
    /^\/splash\/[^/]+\.[^/]+$/.test(pathname) ||
    pathname.startsWith('/_next/')
  );
}

const PRO_ASSET_MAP: Record<string, string> = {
  '/manifest.json': '/pro-manifest.json',
  '/icon-192.png': '/pro-icon-192.png',
  '/icon-512.png': '/pro-icon-512.png',
};

// pathname === '/admin' o pathname empieza con '/admin/' — NO
// pathname.startsWith('/admin') a secas, que matchea por texto y agarra
// también /admin-manifest.json, /admin-icon-192.png, etc. (que no son
// rutas bajo /admin, son archivos hermanos con ese prefijo).
function esRutaAdminVieja(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function noEncontrado(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

// Rewrite interno a `nuevoPathname`, conservando query y host. Fuerza 'http:'
// porque el proceso Node solo escucha HTTP plano en :3000 (nginx termina TLS)
// y el rewrite hace un fetch interno real a ese origin; sin esto tira
// EPROTO/"wrong version number" (ver el comentario del rewrite de admin).
function reescribir(request: NextRequest, nuevoPathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.protocol = 'http:';
  url.pathname = nuevoPathname;
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  // Se normaliza (minúsculas, sin puerto): `ADMIN.TURNETTO.COM` o
  // `admin.turnetto.com:443` son el mismo host que `admin.turnetto.com`.
  const host = normalizarHost(request.headers.get('host'));
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
    // El portal de profesionales tampoco existe en el tenant: /pro* solo
    // responde en profesionales.turnetto.com (o en un host interno/dev).
    if (esRutaAdminVieja(pathname) || tienePrefijoPro(pathname)) {
      return noEncontrado();
    }
    return NextResponse.next();
  }

  if (host === RESERVAR_HOST) {
    if (esArchivoEstatico(pathname)) {
      return NextResponse.next();
    }
    // Idempotente: una ruta que YA trae el prefijo (bug real visto en prod —
    // useIr() ahora lo saca antes de navegar, ver lib/reservaOnline/rutas.ts,
    // pero un link viejo, un bookmark o un service worker con una página
    // vieja en caché podría seguir pidiendo /reservar/... tal cual) no debe
    // duplicarse en /reservar/reservar/... (404).
    if (pathname === '/reservar' || pathname.startsWith('/reservar/')) {
      return NextResponse.next();
    }
    // Mismo motivo que el rewrite de admin más abajo: forzar 'http:' porque
    // el proceso Node solo escucha HTTP plano en :3000 (nginx termina TLS),
    // y este rewrite hace un fetch interno real a ese origin.
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = `/reservar${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === PRO_HOST) {
    const assetPro = PRO_ASSET_MAP[pathname];
    if (assetPro) {
      return reescribir(request, assetPro);
    }
    if (esArchivoPublico(pathname)) {
      return NextResponse.next();
    }
    // Idempotente: una ruta que YA trae /pro (link viejo, bookmark, service
    // worker con una página en caché, o el fetch interno de Next) no debe
    // duplicarse en /pro/pro/... (404).
    if (tienePrefijoPro(pathname)) {
      return NextResponse.next();
    }
    return reescribir(request, pathname === '/' ? '/pro' : `/pro${pathname}`);
  }

  if (host !== ADMIN_HOST) {
    // Host interno/dev (localhost, 127.0.0.1, cualquier puerto): incluye el
    // fetch interno de Next resolviendo su propio rewrite (Host:
    // localhost:3000) y `npm run dev`. Dejar pasar sin tocar — también
    // /admin/* y /pro/*, que es justo lo que ese fetch interno pide.
    if (esHostInterno(host)) {
      return NextResponse.next();
    }
    // Host externo desconocido (apex, www, IP pelada, otro dominio): ni el
    // panel admin ni el portal de profesionales deben ser alcanzables ahí. El
    // resto pasa como siempre.
    if (esRutaAdminVieja(pathname) || tienePrefijoPro(pathname)) {
      return noEncontrado();
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

  if (ADMIN_PAGES.has(pathname) || esRutaUso(pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Ruta vieja con el prefijo directo (admin.turnetto.com/admin,
  // /admin/login) — no debe responder, solo existe la versión limpia. Va
  // ANTES del chequeo de estáticos: /admin/x.png no es un archivo de public/.
  // Lo mismo vale para /pro*: /pro/turnos/1.x no es un archivo y, si pasara el
  // bypass de estáticos, llegaría a la página dinámica del portal.
  if (esRutaAdminVieja(pathname) || tienePrefijoPro(pathname)) {
    return noEncontrado();
  }

  // Archivos reales de public/ (splash/*, sw.js, workbox-*, favicon.ico,
  // *.svg, /admin-manifest.json por su nombre real...) — se sirven tal cual,
  // sin prefijo. Ver comentario largo arriba del porqué.
  if (esArchivoEstatico(pathname)) {
    return NextResponse.next();
  }

  // Allowlist cerrada: cualquier otra cosa (pantallas del tenant, /reservar,
  // slugs, ids de /uso mal formados) no existe en el host admin.
  return noEncontrado();
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
