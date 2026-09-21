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
//
// Toda la API va NetworkOnly, salvo /storage/ (logos y fotos publicas, que
// entran por <img>): antes solo estaban excluidos algunos prefijos y el
// catch-all de next-pwa guardaba /clientes, /turnos, /gastos, etc. (con datos
// de la sesion) en la cache 'cross-origin', sin separar por usuario ni vaciarla
// al cerrar sesion — la persona siguiente en un celular compartido podia ver
// datos de la anterior si fallaba la red. La app no tiene modo offline para
// esos datos, asi que cachearlos solo agregaba riesgo.
const rutasSensiblesSinCache = new RegExp(
  `^https://(connect\\.facebook\\.net/|${apiHostEscapado}/(?!(api/)?storage/))`
);

// LocationIQ (Slice A del mapa de ubicación) — dos hosts, dos políticas
// opuestas. Ambos son RegExp LITERALES autocontenidos (mismo gotcha que
// `rutasSensiblesSinCache` arriba: workbox serializa `urlPattern` con
// `.toString()`, así que nada acá puede cerrar sobre una variable de este
// módulo Node o queda un identificador suelto en sw.js).
//
// Geocoding: una respuesta rancia centraría el mapa en la dirección vieja —
// NetworkOnly, nunca debe quedar en Cache Storage.
const geocodingLocationIq = /^https:\/\/(us1|eu1)\.locationiq\.com\/v1\//;
// Tiles: inmutables por z/x/y (mismo tile siempre pinta lo mismo) —
// CacheFirst acotado (120 entradas / 7 días) para no llenar Cache Storage
// sin límite en un uso intensivo del picker.
const tilesLocationIq = /^https:\/\/[a-z]-tiles\.locationiq\.com\/v3\//;

const withPWA = require("next-pwa")({
  dest: "public",
  // El auto-registro de next-pwa inyecta en el entry 'main.js' de webpack
  // (Pages Router) — esta app es App Router (entry 'main-app'), así que esa
  // inyección nunca corría (confirmado: cero requests a /sw.js al cargar,
  // en ningún dominio). Registro manual en app/providers.tsx en su lugar.
  register: false,
  skipWaiting: true,
  // `skipWaiting` sin esto solo hace que el SW nuevo se ACTIVE apenas puede —
  // no toma control de las pestañas/paneles ya abiertos hasta que navegan de
  // nuevo. `clientsClaim` lo hace tomar control de inmediato, que es lo que
  // dispara el "controllerchange" que `app/providers.tsx` escucha para
  // recargar solo. Sin esto, una instancia de la PWA que nunca hace una
  // navegación fresca (el caso típico de iOS: se suspende y resume, no
  // recarga) puede quedar corriendo JS viejo indefinidamente aunque el SW
  // nuevo ya esté instalado.
  clientsClaim: true,
  // Limpieza automática de precache viejo en cada activación — evita que
  // Cache Storage acumule versiones de assets de deploys anteriores.
  cleanupOutdatedCaches: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    { urlPattern: rutasSensiblesSinCache, handler: "NetworkOnly" },
    { urlPattern: geocodingLocationIq, handler: "NetworkOnly" },
    {
      urlPattern: tilesLocationIq,
      handler: "CacheFirst",
      options: {
        cacheName: "locationiq-tiles",
        expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Las dos reglas de arriba DEBEN ir antes de este spread — next-pwa/cache
    // termina con un NetworkFirst catch-all para cualquier GET cross-origin,
    // y workbox matchea en orden de array.
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