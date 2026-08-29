import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Vitest does NOT go through the Next.js compiler. `@vitejs/plugin-react`
// (Babel) transforms JSX for the files under test; every file we test is a
// `'use client'` module, so there is no RSC boundary to emulate. Path alias
// `@/*` is resolved by `vite-tsconfig-paths`, which reads the existing
// tsconfig.json so the mapping never drifts from the app config.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**', '**/*.spec.ts'],
  },
});
