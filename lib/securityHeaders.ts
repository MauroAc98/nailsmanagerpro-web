// Cabeceras de seguridad de la app (app/admin/reservar.turnetto.com salen del
// mismo build). Antes la app no mandaba ninguna: se podia embeber en un iframe
// de cualquier sitio (clickjacking, sobre todo sobre /admin) y nada forzaba
// HTTPS en el navegador.
//
// El CSP es a proposito ACOTADO (sin script-src/default-src): un CSP de
// scripts exigiria nonces para el script inline del tema, el SDK de Facebook,
// LocationIQ y el service worker, y un error ahi deja la app en blanco. Esto
// cubre lo que si es seguro cerrar ya: iframes, plugins, <base> y formularios.
//
// HSTS sin includeSubDomains ni preload: es facil de agregar despues y muy
// dificil de deshacer si algun subdominio no tuviera HTTPS.
export const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
