import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL keeps mounted trees between tests unless told otherwise; `globals: true`
// gives us the global `afterEach`, but importing it explicitly keeps this file
// type-checkable on its own.
afterEach(() => {
  cleanup();
});

// jsdom (nwsapi) no soporta las pseudo-clases :modal, :popover-open ni :fullscreen:
// `matches()` lanza, y la logica de posicion de los popovers (floating-ui / Base UI)
// reintenta en cascada — medido: ~128 millones de llamadas y ~1 minuto de CPU por cada
// popover que se abre, que ademas enlentece todos los tests que siguen. Un navegador
// sin top layer contestaria "no coincide": eso devolvemos sin pasar por el motor de selectores.
const PSEUDO_SIN_SOPORTE_EN_JSDOM = new Set([':modal', ':popover-open', ':fullscreen']);
if (typeof Element !== 'undefined') {
  const matchesOriginal = Element.prototype.matches;
  Element.prototype.matches = function matches(this: Element, selector: string): boolean {
    if (PSEUDO_SIN_SOPORTE_EN_JSDOM.has(selector)) return false;
    return matchesOriginal.call(this, selector);
  };
}

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
