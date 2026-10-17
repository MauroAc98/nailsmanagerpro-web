// Única fuente de verdad de los hosts de producción y de las páginas del
// panel admin. Antes estaban duplicados (middleware.ts, esPanelAdmin.ts,
// reservaOnline/host.ts) y se comparaban con `===` sobre el header crudo.
//
// admin/app/reservar.turnetto.com son el MISMO build y el MISMO proceso Next
// (nginx proxea los tres a localhost:3000 con `Host: $host`): el host decide
// qué se sirve.
export const ADMIN_HOST = 'admin.turnetto.com';
export const APP_HOST = 'app.turnetto.com';
export const RESERVAR_HOST = 'reservar.turnetto.com';
// Portal de profesionales (login solo lectura). Mismo build/proceso: todo su
// subárbol vive bajo el prefijo /pro (app/(profesionales)/pro).
export const PRO_HOST = 'profesionales.turnetto.com';

// pathname === '/pro' o empieza con '/pro/' — NO startsWith('/pro') a secas,
// que agarraría /prox, /professionals y /pro-manifest.json (archivo hermano).
export function tienePrefijoPro(pathname: string): boolean {
  return pathname === '/pro' || pathname.startsWith('/pro/');
}

// Host tal como llega en el header: minúsculas, sin espacios, sin puerto y
// sin el punto final de un FQDN ("admin.turnetto.com." también es válido).
// Soporta IPv6 entre corchetes ("[::1]:3000" -> "[::1]").
export function normalizarHost(host: string | null | undefined): string {
  let h = (host ?? '').trim().toLowerCase();
  if (h.startsWith('[')) {
    const cierre = h.indexOf(']');
    return cierre === -1 ? h : h.slice(0, cierre + 1);
  }
  const dosPuntos = h.indexOf(':');
  if (dosPuntos !== -1) h = h.slice(0, dosPuntos);
  return h.endsWith('.') ? h.slice(0, -1) : h;
}

// Host interno/dev, con cualquier puerto. El fetch interno con el que Next
// resuelve un rewrite llega con `Host: localhost:3000` (y `npm run dev`
// también): NO se puede bloquear ni tratar como "host externo desconocido"
// — bug real visto en prod, tumbaba admin.turnetto.com/login.
const HOSTS_INTERNOS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function esHostInterno(host: string | null | undefined): boolean {
  return HOSTS_INTERNOS.has(normalizarHost(host));
}

// Único lugar que define qué URLs limpias existen en el panel — si se
// agrega una página nueva bajo app/(admin)/admin/, sumarla acá también
// (lib/hosts.test.ts compara esta lista contra el filesystem y falla en CI
// si faltan). Excepción: /uso y sus sub-rutas con id de negocio, que no son
// páginas literales — ver esRutaUso.
export const ADMIN_PAGES: ReadonlySet<string> = new Set([
  '/',
  '/login',
  '/negocios/nuevo',
  '/suscripciones',
  '/configuracion',
  '/mercadopago',
]);

// Único rincón del panel que necesita un segmento dinámico (el id del
// negocio) — un Set de strings literales no puede listarlo. Regex acotada a
// las 3 formas reales (/uso, /uso/:id, /uso/:id/dia) en vez de un prefijo
// `startsWith('/uso')` a secas: no matchear de más.
export function esRutaUso(pathname: string): boolean {
  return /^\/uso(\/\d+(\/dia)?)?$/.test(pathname);
}
