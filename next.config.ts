import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
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