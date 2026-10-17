import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProTurnosDia } from '@/hooks/pro/useProTurnosDia';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheTurnosDia, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProListaTurnos, ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});
const lista = (descartados: number, truncated = false): ProListaTurnos => ({ turnos: [], truncated, descartados });

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1), vinculo(2)], vinculoActivoId: 1, bloqueos: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('useProTurnosDia', () => {
  it('pide el día al negocio activo con X-Vinculo-Id explícito y una señal', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista(0));
    const { result } = renderHook(() => useProTurnosDia('2026-10-17'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(turnos).toHaveBeenCalledWith(1, { fecha: '2026-10-17' }, expect.any(AbortSignal));
    expect(cacheTurnosDia.get('1:dia:2026-10-17')).toEqual(lista(0));
  });

  it('expone truncated y descartados en data', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista(3, true));
    const { result } = renderHook(() => useProTurnosDia('2026-10-17'));
    await waitFor(() => expect(result.current.data).toEqual(lista(3, true)));
  });

  it('una fecha inválida o sin negocio activo no pide nada', () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista(0));
    renderHook(() => useProTurnosDia('2026-02-31'));
    act(() => useProAuthStore.setState({ vinculoActivoId: null }));
    renderHook(() => useProTurnosDia('2026-10-17'));
    expect(turnos).not.toHaveBeenCalled();
  });

  it('cambios rápidos de día: se queda con el último', async () => {
    const respuestas: Record<string, ProListaTurnos> = { '2026-10-17': lista(1), '2026-10-18': lista(2) };
    vi.spyOn(proService, 'turnos').mockImplementation(async (_vid, f) => respuestas[f.fecha as string]);
    const { result, rerender } = renderHook(({ f }) => useProTurnosDia(f), { initialProps: { f: '2026-10-17' } });
    rerender({ f: '2026-10-18' });
    await waitFor(() => expect(result.current.data).toEqual(lista(2)));
  });

  it('las cachés son por negocio: el negocio 2 no ve el día cacheado del 1', async () => {
    cacheTurnosDia.set('1:dia:2026-10-17', lista(7));
    vi.spyOn(proService, 'turnos').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProTurnosDia('2026-10-17'));
    expect(result.current.data).toEqual(lista(7));
    act(() => {
      useProAuthStore.getState().elegirVinculo(2);
    });
    expect(result.current.data).toBeNull();
  });
});
