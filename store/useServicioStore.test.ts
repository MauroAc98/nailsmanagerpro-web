import { beforeEach, describe, expect, it, vi } from 'vitest';

// `reordenarServicios` habla con el backend vía `servicioService.reordenar` —
// se mockea para poder probar el update optimista sin red real.
vi.mock('@/services/servicioService', async () => {
  const actual = await vi.importActual<typeof import('@/services/servicioService')>('@/services/servicioService');
  return {
    ...actual,
    servicioService: {
      ...actual.servicioService,
      reordenar: vi.fn(),
    },
  };
});

// `refrescarProfesionales` (llamado desde otras acciones del store, no desde
// reordenarServicios) pega contra profesionalService — mockeado para que
// importar el store no dispare red real.
vi.mock('@/services/profesionalService', () => ({
  profesionalService: { getAll: vi.fn().mockResolvedValue([]) },
}));

// alertDialog real devuelve una Promise que solo resuelve cuando
// ConfirmSheetHost (no montado en este test) llama a resolveDialog — sin
// mockear, el camino de error de reordenarServicios quedaría colgado para
// siempre esperando esa resolución.
vi.mock('@/store/useConfirmStore', () => ({
  alertDialog: vi.fn().mockResolvedValue(undefined),
}));

import { servicioService, type Servicio } from '@/services/servicioService';
import { useServiciosStore } from './useServicioStore';

const mockedReordenar = vi.mocked(servicioService.reordenar);

function servicio(id: number, categoria_id: number | null, orden: number): Servicio {
  return {
    id, user_id: 1, nombre: `Servicio ${id}`, duracion_minutos: 30, precio: null,
    activo: true, es_promo: false, orden, categoria_id,
    created_at: '', updated_at: '',
  };
}

beforeEach(() => {
  mockedReordenar.mockReset();
  useServiciosStore.setState({ servicios: [], loading: false, error: null, buscar: '' });
});

describe('reordenarServicios', () => {
  it('reasigna `orden` (0..n-1) solo para los servicios del grupo reordenado', async () => {
    // Categoría 1: ids 10/11/12 con orden 0/1/2 — se invierte a [12, 11, 10].
    // Categoría 2: id 20 con orden 0 — no participa del reorder, debe quedar intacto.
    useServiciosStore.setState({
      servicios: [
        servicio(10, 1, 0), servicio(11, 1, 1), servicio(12, 1, 2),
        servicio(20, 2, 0),
      ],
    });
    mockedReordenar.mockResolvedValue([]);

    await useServiciosStore.getState().reordenarServicios([12, 11, 10]);

    const porId = new Map(useServiciosStore.getState().servicios.map(s => [s.id, s]));
    expect(porId.get(12)?.orden).toBe(0);
    expect(porId.get(11)?.orden).toBe(1);
    expect(porId.get(10)?.orden).toBe(2);
    // Ajeno al grupo reordenado — ni su posición ni su `orden` cambian.
    expect(porId.get(20)?.orden).toBe(0);
  });

  it('revierte el estado optimista si el backend rechaza el reorder', async () => {
    const original = [servicio(10, 1, 0), servicio(11, 1, 1)];
    useServiciosStore.setState({ servicios: original });
    mockedReordenar.mockRejectedValue(new Error('network'));

    await useServiciosStore.getState().reordenarServicios([11, 10]);

    expect(useServiciosStore.getState().servicios).toEqual(original);
  });
});
