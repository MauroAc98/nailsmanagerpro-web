import { afterEach, describe, expect, it, vi } from 'vitest';
import { obtenerGps } from './obtenerGps';

describe('obtenerGps', () => {
  afterEach(() => {
    // @ts-expect-error -- restaurar entre tests, no todos definen `geolocation`
    delete navigator.geolocation;
  });

  it('resuelve lat/lon cuando el navegador da la posición', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({ coords: { latitude: -27.4692, longitude: -58.8306 } } as GeolocationPosition);
        },
      },
    });
    await expect(obtenerGps()).resolves.toEqual({ lat: -27.4692, lon: -58.8306 });
  });

  it('resuelve null si el usuario rechaza el permiso o falla', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1, message: 'denied' } as GeolocationPositionError);
        },
      },
    });
    await expect(obtenerGps()).resolves.toBeNull();
  });

  it('resuelve null sin navigator.geolocation (no soportado)', async () => {
    // @ts-expect-error -- simular un browser sin soporte
    navigator.geolocation = undefined;
    await expect(obtenerGps()).resolves.toBeNull();
  });

  it('nunca tira, incluso si getCurrentPosition explota', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          throw new Error('boom');
        },
      },
    });
    await expect(obtenerGps()).resolves.toBeNull();
  });
});
