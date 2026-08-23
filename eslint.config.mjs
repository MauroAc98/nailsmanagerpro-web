import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generados por next-pwa en cada build (npm run build --webpack) — no
    // son código fuente, no tiene sentido lintearlos.
    "public/sw.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
