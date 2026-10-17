import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useProRecurso } from '@/hooks/pro/useProRecurso';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheTurnosDia, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProError } from '@/lib/pro/errores';
import type { ProListaTurnos, ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});

const lista = (n: number): ProListaTurnos => ({ turnos: [], truncated: n > 0, descartados: n });

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const errorPro = (proError: ProError) => Object.assign(new Error('x'), { proError });

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({
    status: 'full',
    token: 't',
    vinculos: [vinculo(1), vinculo(2)],
    vinculoActivoId: 1,
    bloqueos: {},
  });
});
afterEach(() => vi.restoreAllMocks());

describe('useProRecurso', () => {
  it('sin clave no pide nada y no está cargando', () => {
    const cargar = vi.fn();
    const { result } = renderHook(() => useProRecurso(null, cargar, cacheTurnosDia));
    expect(cargar).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: null, cargando: false, error: null });
  });

  it('carga, guarda en la caché y deja de cargar', async () => {
    const cargar = vi.fn().mockResolvedValue(lista(1));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.data).toEqual(lista(1));
    expect(cacheTurnosDia.get('1:dia:a')).toEqual(lista(1));
  });

  it('SWR: devuelve al instante lo cacheado y lo refresca de fondo', async () => {
    cacheTurnosDia.set('1:dia:a', lista(1));
    const d = diferido<ProListaTurnos>();
    const cargar = vi.fn().mockReturnValue(d.promesa);
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    expect(result.current.data).toEqual(lista(1));
    expect(result.current.cargando).toBe(true);
    await act(async () => d.resolver(lista(2)));
    expect(result.current.data).toEqual(lista(2));
    expect(result.current.cargando).toBe(false);
  });

  it('pasa un AbortSignal y aborta el pedido anterior al cambiar de clave', async () => {
    const senales: AbortSignal[] = [];
    const cargar = vi.fn((signal: AbortSignal) => {
      senales.push(signal);
      return new Promise<ProListaTurnos>(() => {});
    });
    const { rerender } = renderHook(({ k }) => useProRecurso(k, cargar, cacheTurnosDia), { initialProps: { k: '1:dia:a' } });
    rerender({ k: '1:dia:b' });
    expect(senales).toHaveLength(2);
    expect(senales[0].aborted).toBe(true);
    expect(senales[1].aborted).toBe(false);
  });

  it('aborta al desmontar', () => {
    let senal!: AbortSignal;
    const cargar = (s: AbortSignal) => {
      senal = s;
      return new Promise<ProListaTurnos>(() => {});
    };
    const { unmount } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    unmount();
    expect(senal.aborted).toBe(true);
  });

  it('un pedido cancelado (axios.isCancel) se ignora: sin error, sin bloqueo', async () => {
    const marcar = vi.spyOn(useProAuthStore.getState(), 'marcarBloqueo');
    const d = diferido<ProListaTurnos>();
    const { result } = renderHook(() => useProRecurso('1:dia:a', () => d.promesa, cacheTurnosDia));
    await act(async () => d.rechazar(new axios.CanceledError('cancelado')));
    expect(result.current.error).toBeNull();
    expect(result.current.cargando).toBe(true);
    expect(marcar).not.toHaveBeenCalled();
  });

  it('cambios rápidos de clave: solo vale el último resultado (AG-2 S9)', async () => {
    const a = diferido<ProListaTurnos>();
    const b = diferido<ProListaTurnos>();
    const cargar = vi.fn().mockReturnValueOnce(a.promesa).mockReturnValueOnce(b.promesa);
    const { result, rerender } = renderHook(({ k }) => useProRecurso(k, cargar, cacheTurnosDia), { initialProps: { k: '1:dia:a' } });
    rerender({ k: '1:dia:b' });
    await act(async () => b.resolver(lista(2)));
    await act(async () => a.resolver(lista(1))); // llega tarde
    expect(result.current.data).toEqual(lista(2));
    expect(cacheTurnosDia.get('1:dia:a')).toBeUndefined();
  });

  it('descarta la respuesta tardía de otro negocio tras un cambio (SE-10 S3)', async () => {
    const viejo = diferido<ProListaTurnos>();
    const nuevo = diferido<ProListaTurnos>();
    const cargar = vi.fn().mockReturnValueOnce(viejo.promesa).mockReturnValueOnce(nuevo.promesa);
    const { result } = renderHook(() => {
      const vid = useProAuthStore((s) => s.vinculoActivoId);
      return useProRecurso(vid === null ? null : `${vid}:dia:a`, cargar, cacheTurnosDia);
    });
    act(() => {
      useProAuthStore.getState().elegirVinculo(2);
    });
    await act(async () => viejo.resolver(lista(9))); // turnos del negocio 1
    expect(result.current.data).toBeNull();
    expect(cacheTurnosDia.get('1:dia:a')).toBeUndefined();
    await act(async () => nuevo.resolver(lista(2)));
    expect(result.current.data).toEqual(lista(2));
  });

  it('un cambio de negocio vacía la caché y nunca se ve lo del otro negocio', async () => {
    cacheTurnosDia.set('1:dia:a', lista(1));
    const cargar = vi.fn(() => new Promise<ProListaTurnos>(() => {}));
    const { result } = renderHook(() => {
      const vid = useProAuthStore((s) => s.vinculoActivoId);
      return useProRecurso(vid === null ? null : `${vid}:dia:a`, cargar, cacheTurnosDia);
    });
    expect(result.current.data).toEqual(lista(1));
    act(() => {
      useProAuthStore.getState().elegirVinculo(2);
    });
    expect(result.current.data).toBeNull();
  });

  it('vinculoDisabled marca el bloqueo del negocio activo', async () => {
    const cargar = vi.fn().mockRejectedValue(errorPro({ kind: 'vinculoDisabled' }));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'vinculoDisabled' }));
    expect(useProAuthStore.getState().bloqueos[1]).toEqual({ estado: 'disabled', motivo: null });
  });

  it('noService marca el bloqueo con el motivo', async () => {
    const cargar = vi.fn().mockRejectedValue(errorPro({ kind: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' }));
    renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(useProAuthStore.getState().bloqueos[1]).toBeDefined());
    expect(useProAuthStore.getState().bloqueos[1]).toEqual({ estado: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' });
  });

  it('sessionRevoked no hace nada acá (lo maneja el evento global)', async () => {
    const marcar = vi.spyOn(useProAuthStore.getState(), 'marcarBloqueo');
    const expirar = vi.spyOn(useProAuthStore.getState(), 'expirar');
    const cargar = vi.fn().mockRejectedValue(errorPro({ kind: 'sessionRevoked' }));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'sessionRevoked' }));
    expect(marcar).not.toHaveBeenCalled();
    expect(expirar).not.toHaveBeenCalled();
  });

  it('429 deja error rateLimited, mantiene la sesión y reintentar vuelve a pedir', async () => {
    const cargar = vi
      .fn()
      .mockRejectedValueOnce(errorPro({ kind: 'rateLimited', retryAfterSec: 30, lockout: false }))
      .mockResolvedValueOnce(lista(1));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'rateLimited', retryAfterSec: 30, lockout: false }));
    expect(result.current.cargando).toBe(false);
    expect(useProAuthStore.getState().status).toBe('full');
    act(() => result.current.reintentar());
    expect(result.current.cargando).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.data).toEqual(lista(1)));
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('un error de red es reintentable', async () => {
    const cargar = vi.fn().mockRejectedValueOnce(errorPro({ kind: 'network' })).mockResolvedValueOnce(lista(0));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'network' }));
    act(() => result.current.reintentar());
    await waitFor(() => expect(result.current.data).toEqual(lista(0)));
    expect(result.current.error).toBeNull();
  });

  it('un error sin proError (TypeError) se muestra como server', async () => {
    const cargar = vi.fn().mockRejectedValue(new TypeError('boom'));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'server' }));
  });

  it('con un error se conserva lo cacheado y se informa el error', async () => {
    cacheTurnosDia.set('1:dia:a', lista(1));
    const cargar = vi.fn().mockRejectedValue(errorPro({ kind: 'network' }));
    const { result } = renderHook(() => useProRecurso('1:dia:a', cargar, cacheTurnosDia));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'network' }));
    expect(result.current.data).toEqual(lista(1));
  });

  it('el error de una clave no se arrastra a otra', async () => {
    const cargar = vi.fn().mockRejectedValueOnce(errorPro({ kind: 'server' })).mockReturnValue(new Promise<ProListaTurnos>(() => {}));
    const { result, rerender } = renderHook(({ k }) => useProRecurso(k, cargar, cacheTurnosDia), { initialProps: { k: '1:dia:a' } });
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'server' }));
    rerender({ k: '1:dia:b' });
    expect(result.current.error).toBeNull();
    expect(result.current.cargando).toBe(true);
  });
});
