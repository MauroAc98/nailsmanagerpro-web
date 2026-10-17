import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProTurnosRango, type ParamsRango } from '@/hooks/pro/useProTurnosRango';
import { useProAuthStore } from '@/store/useProAuthStore';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProListaTurnos, ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});
const vacia: ProListaTurnos = { turnos: [], truncated: false, descartados: 0 };
const base: ParamsRango = { desde: '2026-10-01', hasta: '2026-10-31', buscar: '', servicioId: null };

let turnos: MockInstance<typeof proService.turnos>;

beforeEach(() => {
  vi.useFakeTimers();
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1)], vinculoActivoId: 1, bloqueos: {} });
  turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(vacia);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useProTurnosRango', () => {
  it('pide con desde/hasta (nunca fecha) y servicio_id', async () => {
    renderHook(() => useProTurnosRango({ ...base, servicioId: 4 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(turnos).toHaveBeenCalledWith(1, { desde: '2026-10-01', hasta: '2026-10-31', servicio_id: 4 }, expect.any(AbortSignal));
    expect(turnos.mock.calls[0][1]).not.toHaveProperty('fecha');
  });

  it('debouncea buscar 300 ms: una sola consulta con el texto final, recortado', async () => {
    const { rerender } = renderHook(({ p }) => useProTurnosRango(p), { initialProps: { p: base } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    turnos.mockClear();
    for (const texto of ['a', 'an', ' ana ']) {
      rerender({ p: { ...base, buscar: texto } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    expect(turnos).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(turnos).toHaveBeenCalledTimes(1);
    expect(turnos.mock.calls[0][1]).toEqual({ desde: '2026-10-01', hasta: '2026-10-31', buscar: 'ana' });
  });

  it.each([
    ['rango invertido', { desde: '2026-10-31', hasta: '2026-10-01' }, 'rango'],
    ['rango de más de 366 días', { desde: '2025-01-01', hasta: '2026-10-01' }, 'rango'],
    ['antes del año 2000', { desde: '1999-12-31', hasta: '2000-01-02' }, 'rango'],
    ['fecha inexistente', { desde: '2026-02-30', hasta: '2026-03-02' }, 'rango'],
    ['buscar de más de 60 caracteres', { buscar: 'a'.repeat(61) }, 'buscar'],
    ['buscar de más de 5 palabras', { buscar: 'uno dos tres cuatro cinco seis' }, 'buscar'],
  ])('%s: no pide nada y marca el motivo', async (_n, cambios, motivo) => {
    const { result } = renderHook(() => useProTurnosRango({ ...base, ...cambios }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(turnos).not.toHaveBeenCalled();
    expect(result.current.invalido).toBe(motivo);
    expect(result.current.cargando).toBe(false);
  });

  it('acepta 5 palabras, 60 caracteres y el rango de 366 días', async () => {
    const { result } = renderHook(() => useProTurnosRango({ desde: '2026-01-01', hasta: '2026-12-31', buscar: 'uno dos tres cuatro cinco', servicioId: null }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.invalido).toBeNull();
    expect(turnos).toHaveBeenCalledTimes(1);
  });

  it('si el texto actual es inválido no se manda el último válido', async () => {
    const { rerender } = renderHook(({ p }) => useProTurnosRango(p), { initialProps: { p: { ...base, buscar: 'ana' } } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    turnos.mockClear();
    rerender({ p: { ...base, buscar: 'a b c d e f' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(turnos).not.toHaveBeenCalled();
  });

  it('expone truncated y descartados', async () => {
    turnos.mockResolvedValue({ turnos: [], truncated: true, descartados: 2 });
    const { result } = renderHook(() => useProTurnosRango(base));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual({ turnos: [], truncated: true, descartados: 2 });
  });
});
