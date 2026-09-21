import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHES_CON_DATOS_DE_SESION, limpiarCachesDeSesion } from './limpiarCachesSw';

function simularCacheStorage(existentes: string[]) {
  const borradas: string[] = [];
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      keys: async () => existentes,
      delete: async (nombre: string) => {
        borradas.push(nombre);
        return true;
      },
    },
  });
  return borradas;
}

describe('limpiarCachesDeSesion', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'caches');
  });

  it('borra las caches donde el service worker pudo guardar respuestas de la API', async () => {
    const borradas = simularCacheStorage(['cross-origin', 'apis', 'others', 'static-js-assets']);
    await limpiarCachesDeSesion();
    expect(borradas.sort()).toEqual(['apis', 'cross-origin', 'others']);
  });

  it('no toca las caches de assets estaticos ni los tiles del mapa', async () => {
    const borradas = simularCacheStorage(['static-js-assets', 'next-image', 'locationiq-tiles']);
    await limpiarCachesDeSesion();
    expect(borradas).toEqual([]);
  });

  it('no falla si el navegador no tiene Cache Storage', async () => {
    Reflect.deleteProperty(globalThis, 'caches');
    await expect(limpiarCachesDeSesion()).resolves.toBeUndefined();
  });

  it('no propaga errores de Cache Storage (nunca debe romper el logout)', async () => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { keys: vi.fn().mockRejectedValue(new Error('boom')), delete: vi.fn() },
    });
    await expect(limpiarCachesDeSesion()).resolves.toBeUndefined();
  });

  it('expone la lista de caches que limpia', () => {
    expect(CACHES_CON_DATOS_DE_SESION).toEqual(['cross-origin', 'apis', 'others']);
  });
});
