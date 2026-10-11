import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnoMes } from '@/services/turnoService';

const mocks = vi.hoisted(() => ({ getByMes: vi.fn() }));
vi.mock('@/services/turnoService', () => ({ turnoService: { getByMes: mocks.getByMes } }));

import { useMarcasMesProfesional, vaciarCacheMarcasMes } from './useMarcasMesProfesional';

const octubre = new Date(2026, 9, 1);
const marcas = (cantidad: number): TurnoMes[] => [{ fecha: '2026-10-05', cantidad }];

beforeEach(() => {
  mocks.getByMes.mockReset();
  vaciarCacheMarcasMes();
});

describe('useMarcasMesProfesional', () => {
  it('sin profesional puntual no pide nada y no devuelve marcas', () => {
    const { result } = renderHook(() => useMarcasMesProfesional(true, null, octubre));
    expect(result.current).toEqual([]);
    expect(mocks.getByMes).not.toHaveBeenCalled();
  });

  it('pide el mes de la profesional y devuelve sus marcas', async () => {
    mocks.getByMes.mockResolvedValue(marcas(2));
    const { result } = renderHook(() => useMarcasMesProfesional(true, 7, octubre));
    await waitFor(() => expect(result.current).toEqual(marcas(2)));
    expect(mocks.getByMes).toHaveBeenCalledWith('2026-10', 7);
  });

  it('al pasar a otra profesional nunca muestra las marcas de la anterior mientras carga', async () => {
    mocks.getByMes.mockResolvedValueOnce(marcas(2));
    const { result, rerender } = renderHook(({ id }) => useMarcasMesProfesional(true, id, octubre), { initialProps: { id: 7 } });
    await waitFor(() => expect(result.current).toEqual(marcas(2)));

    mocks.getByMes.mockImplementation(() => new Promise(() => {}));
    rerender({ id: 8 });

    expect(result.current).toEqual([]);
  });

  it('al volver a una profesional ya vista muestra sus marcas al instante y refresca de fondo', async () => {
    mocks.getByMes.mockResolvedValueOnce(marcas(2)).mockResolvedValueOnce(marcas(9));
    const { result, rerender } = renderHook(({ id }) => useMarcasMesProfesional(true, id, octubre), { initialProps: { id: 7 } });
    await waitFor(() => expect(result.current).toEqual(marcas(2)));
    rerender({ id: 8 });
    await waitFor(() => expect(result.current).toEqual(marcas(9)));

    mocks.getByMes.mockResolvedValueOnce(marcas(3));
    rerender({ id: 7 });

    expect(result.current).toEqual(marcas(2)); // cacheado, sin esperar
    await waitFor(() => expect(result.current).toEqual(marcas(3))); // refrescado
  });
});
