import type { NextConfig } from "next";
// Default runtimeCaching de next-pwa (no reescribirlo desde cero: perdería
// la caché de assets estáticos, etc. — solo se le antepone una regla).
// Nombre distinto del que arma el array final más abajo (antes ambos se
// llamaban `runtimeCaching`, confuso al leer/grepear cuál es cuál).
const defaultRuntimeCaching = require("next-pwa/cache");

// Derivado de NEXT_PUBLIC_API_URL (la misma fuente que usa lib/api.ts para
// el baseURL de axios) en vez de hardcodeado — así un deploy de staging con
// otro subdominio no desalinea silenciosamente esta regla ni la de
// images.remotePatterns de abajo.
const apiHostname = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.turnetto.com"
).hostname;

// workbox serializa `urlPattern` (via Function/RegExp .toString()) e lo
// inyecta tal cual en sw.js. Una FUNCIÓN que cierre sobre `apiHostname`
// —variable de este módulo Node— queda con ese identificador SUELTO en el
// service worker → "ReferenceError: apiHostname is not defined" en cada
// request, tirado por workbox-routing.findMatchingRoute (y con él, todo el
// routing del SW deja de andar). Un RegExp se serializa como literal
// autocontenido y no cierra sobre nada, así que el hostname se hornea acá
// dentro del patrón.
//
// Escapa metacaracteres de regex del hostname (los `.`, sobre todo) antes
// de interpolarlo.
const apiHostEscapado = apiHostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GETs que NUNCA deben servirse rancios desde la caché del SW (NetworkOnly).
// El resto de next-pwa/cache trata cualquier GET cross-origin como
// NetworkFirst con hasta 1h de caché si la red está inestable; para estas
// rutas eso sería un bug:
//   - connect.facebook.net/* — SDK de Embedded Signup (solo /admin/whatsapp),
//     JS cross-origin que no puede quedar viejo.
//   - {apiHost}/(api/)?auth/*  — sesión/suscripción: un `subscriptionExpired:
//     false` cacheado dejaría a alguien vencido usando la app hasta 1h.
//   - {apiHost}/(api/)?support-info
//   - {apiHost}/(api/)?admin/* — /admin/negocios/buscar y
//     /admin/whatsapp/uso-por-salon dejarían emails/nombres de negocios
//     ajenos en Cache Storage, legibles sin token incluso tras un logout.
// El prefijo `/api/` es opcional: en prod NEXT_PUBLIC_API_URL termina en
// "/api" (Laravel sirve /api/auth/..., no /auth/...); en local puede no
// tenerlo. Va primero en el array porque workbox matchea en orden.
const rutasSensiblesSinCache = new RegExp(
  `^https://(connect\\.facebook\\.net/|${apiHostEscapado}/(api/)?(auth/|support-info($|\\?)|admin/))`
);

const withPWA = require("next-pwa")({
  dest: "public",
  // El auto-registro de next-pwa inyecta en el entry 'main.js' de webpack
  // (Pages Router) — esta app es App Router (entry 'main-app'), así que esa
  // inyección nunca corría (confirmado: cero requests a /sw.js al cargar,
  // en ningún dominio). Registro manual en app/providers.tsx en su lugar.
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    { urlPattern: rutasSensiblesSinCache, handler: "NetworkOnly" },
    ...defaultRuntimeCaching,
  ],
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  images: {
    // Logo del negocio en LoginScreen (/login/{slug}) — servido por la API.
    remotePatterns: [
      { protocol: "https", hostname: apiHostname },
    ],
  },
  // Páginas legales servidas como HTML estático desde public/legal/*.html
  // (fuera del árbol de React), para que Meta/Google y sus crawlers puedan
  // leerlas sin JS y a cualquier viewport — la app en sí está detrás del
  // gate CSS de 600px (globals.css) y del i18n client-side, que dejarían a
  // un revisor en desktop viendo solo "Turnetto es para celular". El rewrite
  // solo expone URLs limpias; el archivo real vive en public/.
  async rewrites() {
    return [
      { source: "/privacy", destination: "/legal/privacy.html" },
      { source: "/terms", destination: "/legal/terms.html" },
      { source: "/data-deletion", destination: "/legal/data-deletion.html" },
      // Página pública de servicio (para revisión de Meta como proveedor de
      // tecnología / crawlers) — mismo motivo que las legales: HTML estático
      // fuera del árbol de React, legible sin JS y en desktop.
      { source: "/servicio", destination: "/servicio.html" },
    ];
  },
};

module.exports = withPWA(nextConfig);