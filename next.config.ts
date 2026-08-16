import type { NextConfig } from "next";
// Default runtimeCaching de next-pwa (no reescribirlo desde cero: perdería
// la caché de assets estáticos, etc. — solo se le antepone una regla).
const runtimeCaching = require("next-pwa/cache");
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // El resto de next-pwa/cache trata cualquier GET cross-origin (o sea,
    // cualquier llamada a la API en api.nailsmanagerpro.com, otro
    // subdominio) como "cross-origin": NetworkFirst con hasta 1h de caché
    // si la red está inestable. Para /auth/* y /support-info eso puede
    // dejar a alguien con la sesión/suscripción vencida viendo el estado
    // viejo (ej. subscriptionExpired: false) hasta una hora — van
    // primero acá, sin caché, porque workbox matchea en orden y la
    // primera regla que matchea gana.
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.hostname === "api.nailsmanagerpro.com" &&
        (url.pathname.startsWith("/auth/") || url.pathname === "/support-info"),
      handler: "NetworkOnly",
    },
    ...runtimeCaching,
  ],
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  images: {
    // Logo del negocio en LoginScreen (/login/{slug}) — servido por la API,
    // único host en .env.local y .env.production (NEXT_PUBLIC_API_URL).
    remotePatterns: [
      { protocol: "https", hostname: "api.nailsmanagerpro.com" },
    ],
  },
};

module.exports = withPWA(nextConfig);