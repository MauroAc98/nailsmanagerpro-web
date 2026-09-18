import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoadingStore } from '@/store/useLoadingStore';
import { withGlobalLoader } from './withGlobalLoader';

describe('withGlobalLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLoadingStore.setState({ isLoading: false });
  });
  afterEach(() => vi.useRealTimers());

  it('sin opciones: prende el loader, corre fn enseguida y lo apaga al terminar', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const promesa = withGlobalLoader(fn);

    expect(useLoadingStore.getState().isLoading).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(promesa).resolves.toBe('ok');
    expect(useLoadingStore.getState().isLoading).toBe(false);
  });

  // iOS Safari: pedir permisos/ubicación en el mismo tick en que se prende el
  // loader hace saltar el aviso nativo (o resuelve con una posición cacheada)
  // antes de que el loader llegue a pintarse — el usuario nunca lo ve.
  describe('con { pintarAntes, minMs }', () => {
    it('deja pintar el loader antes de correr fn', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const promesa = withGlobalLoader(fn, { pintarAntes: true });

      expect(useLoadingStore.getState().isLoading).toBe(true);
      expect(fn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(1);
      await expect(promesa).resolves.toBe('ok');
    });

    it('mantiene el loader visible al menos minMs aunque fn resuelva al toque', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const promesa = withGlobalLoader(fn, { pintarAntes: true, minMs: 600 });

      await vi.advanceTimersByTimeAsync(300);
      expect(useLoadingStore.getState().isLoading).toBe(true);

      await vi.advanceTimersByTimeAsync(400);
      await expect(promesa).resolves.toBe('ok');
      expect(useLoadingStore.getState().isLoading).toBe(false);
    });

    it('apaga el loader aunque fn falle', async () => {
      const promesa = withGlobalLoader(() => Promise.reject(new Error('boom')), { pintarAntes: true, minMs: 300 });
      const assertion = expect(promesa).rejects.toThrow('boom');
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
      expect(useLoadingStore.getState().isLoading).toBe(false);
    });
  });
});
