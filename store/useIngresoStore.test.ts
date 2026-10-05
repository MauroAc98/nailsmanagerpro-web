import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingresoService } from '@/services/ingresoService';
import { useIngresosStore } from './useIngresoStore';

const dto = { concepto: 'Venta', monto: 2000, fecha: '2026-10-05' } as never;

beforeEach(() => {
  vi.restoreAllMocks();
  useIngresosStore.setState({ ingresos: [], loading: false, error: null, rangoActual: undefined });
});

describe('agregarIngreso', () => {
  it('si el ingreso se guardó pero el refetch falla, igual es éxito (reintentar duplicaría el ingreso)', async () => {
    const create = vi.spyOn(ingresoService, 'create').mockResolvedValue({} as never);
    vi.spyOn(ingresoService, 'getAll').mockRejectedValue(new Error('network'));

    const res = await useIngresosStore.getState().agregarIngreso(dto);

    expect(res.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('si el create falla, devuelve el error y no refresca', async () => {
    vi.spyOn(ingresoService, 'create').mockRejectedValue(new Error('boom'));
    const getAll = vi.spyOn(ingresoService, 'getAll').mockResolvedValue([]);

    const res = await useIngresosStore.getState().agregarIngreso(dto);

    expect(res.success).toBe(false);
    expect(getAll).not.toHaveBeenCalled();
  });
});
