// ¿Esta pantalla es del panel de administración?
//
// - admin.turnetto.com sirve el panel con URLs limpias (/, /login, ...); el
//   middleware las reescribe por dentro a /admin/*, así que ahí manda el host.
// - En cualquier otro host (localhost, app.turnetto.com) no hay reescrito: las
//   páginas del panel viven bajo /admin y manda el prefijo de la ruta.
//
// Las dos guardas (la del salón y la del panel) usan esta misma pregunta: si
// cada una la respondiera distinto, se empujarían entre sí en un bucle.
const ADMIN_HOST = 'admin.turnetto.com';

export function tienePrefijoAdmin(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

// `hostname` es null donde no hay window (renderizado en servidor): ahí solo
// decide el prefijo de la ruta.
export function esPanelAdmin(hostname: string | null, pathname: string): boolean {
  return hostname === ADMIN_HOST || tienePrefijoAdmin(pathname);
}
