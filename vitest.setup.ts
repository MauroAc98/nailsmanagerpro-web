import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL keeps mounted trees between tests unless told otherwise; `globals: true`
// gives us the global `afterEach`, but importing it explicitly keeps this file
// type-checkable on its own.
afterEach(() => {
  cleanup();
});

// jsdom ships no `matchMedia`. Several components (theme, responsive helpers)
// read it at mount; without this polyfill they throw before any assertion.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}
