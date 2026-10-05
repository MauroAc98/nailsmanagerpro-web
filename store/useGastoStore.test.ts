import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gastoService } from '@/services/gastoService';
import { useGastosStore } from './useGastoStore';

const dto = { concepto: 'Esmaltes', monto: 1500, fecha: '2026-10-05' } as never;

beforeEach(() => {
  vi.restoreAllMocks();
  useGastosStore.setState({ gastos: [], loading: false, error: null, rangoActual: undefined });
});

describe('agregarGasto', () => {
  it('si el gasto se guardó pero el refetch falla, igual es éxito (reintentar duplicaría el gasto)', async () => {
    const create = vi.spyOn(gastoService, 'create').mockResolvedValue({} as never);
    vi.spyOn(gastoService, 'getAll').mockRejectedValue(new Error('network'));

    const res = await useGastosStore.getState().agregarGasto(dto);

    expect(res.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('si el create falla, devuelve el error y no refresca', async () => {
    vi.spyOn(gastoService, 'create').mockRejectedValue(new Error('boom'));
    const getAll = vi.spyOn(gastoService, 'getAll').mockResolvedValue([]);

    const res = await useGastosStore.getState().agregarGasto(dto);

    expect(res.success).toBe(false);
    expect(getAll).not.toHaveBeenCalled();
  });
});
