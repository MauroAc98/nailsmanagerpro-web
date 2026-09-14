import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeUbicacion } from './geocodeUbicacion';

// Best-effort forward geocode (design D5): plain `fetch` (NOT the axios `api`
// instance — that attaches the app bearer token/baseURL, wrong for a public
// third-party host), 4s abort timeout, NEVER throws — any failure resolves
// to null so opening the map picker is never blocked on the network.

describe('geocodeUbicacion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves to null when the request times out (abort)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, opts?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = geocodeUbicacion('Av. Siempreviva 742');
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;

    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('resolves to null on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await geocodeUbicacion('Av. Siempreviva 742');

    expect(result).toBeNull();
  });

  it('resolves to null when the API returns an empty array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    }));

    const result = await geocodeUbicacion('direccion inexistente');

    expect(result).toBeNull();
  });

  it('resolves to numeric lat/lon on a successful match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ lat: '-27.4692', lon: '-58.8306' }]),
    }));

    const result = await geocodeUbicacion('Corrientes, Argentina');

    expect(result).toEqual({ lat: -27.4692, lon: -58.8306 });
  });

  it('never throws — resolves to null when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(geocodeUbicacion('cualquier direccion')).resolves.toBeNull();
  });
});
