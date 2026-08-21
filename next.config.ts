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
    // si la red está inestable. Para /auth/* y /support-info eso puede
    // dejar a alguien con la sesión/suscripción vencida viendo el estado
    // viejo (ej. subscriptionExpired: false) hasta una hora — van
    // primero acá, sin caché, porque workbox matchea en orden y la
    // primera regla que matchea gana.
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.hostname === apiHostname &&
        (url.pathname.startsWith("/auth/") || url.pathname === "/support-info"),
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