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

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // El resto de next-pwa/cache trata cualquier GET cross-origin (o sea,
    // cualquier llamada a la API en api.turnetto.com, otro
    // subdominio) como "cross-origin": NetworkFirst con hasta 1h de caché
    // si la red está inestable. Para /auth/*, /support-info y /admin/* eso
    // puede dejar a alguien con la sesión/suscripción vencida viendo el
    // estado viejo (ej. subscriptionExpired: false) hasta una hora, o peor
    // — para /admin/negocios/buscar y /admin/whatsapp/uso-por-salon,
    // dejaría emails/nombres de negocios ajenos en Cache Storage,
    // legibles sin token y repetibles incluso después de un logout. Van
    // primero acá, sin caché, porque workbox matchea en orden y la
    // primera regla que matchea gana.
    //
    // Gotcha confirmado (ver design admin-panel, sección PWA): en
    // producción NEXT_PUBLIC_API_URL termina en "/api"
    // (https://api.turnetto.com/api), así que Laravel sirve estas rutas
    // bajo /api/auth/..., no /auth/... — el matcher original solo
    // chequeaba url.pathname.startsWith("/auth/"), que nunca matcheaba en
    // el deploy real (no-op silencioso: /auth/* y /support-info se
    // cacheaban 1h igual). El prefijo "/api/" opcional lo corrige acá para
    // ambas familias de rutas, tolerante a cualquier valor futuro de
    // NEXT_PUBLIC_API_URL con o sin ese prefijo.
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.hostname === apiHostname &&
        (/^\/(api\/)?auth\//.test(url.pathname) ||
          /^\/(api\/)?support-info$/.test(url.pathname) ||
          /^\/(api\/)?admin\//.test(url.pathname)),
      handler: "NetworkOnly",
    },
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
};

module.exports = withPWA(nextConfig);