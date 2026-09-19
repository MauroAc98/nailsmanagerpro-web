import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mismo criterio que useServicioStore.test.ts: se mockea la capa de
// servicio (no el store), para poder probar el wiring sin red real.
vi.mock('@/services/bloqueoAgendaService', async () => {
  const actual = await vi.importActual<typeof import('@/services/bloqueoAgendaService')>('@/services/bloqueoAgendaService');
  return {
    ...actual,
    bloqueoAgendaService: {
      getAll: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { bloqueoAgendaService, type BloqueoAgenda } from '@/services/bloqueoAgendaService';
import { useBloqueosAgendaStore } from './useBloqueosAgendaStore';

const mockedGetAll = vi.mocked(bloqueoAgendaService.getAll);
const mockedCreate = vi.mocked(bloqueoAgendaService.create);
const mockedDelete = vi.mocked(bloqueoAgendaService.delete);

function buildBloqueo(overrides: Partial<BloqueoAgenda> = {}): BloqueoAgenda {
  return {
    id: 1, user_id: 1, profesional_id: null, fecha: '2099-01-01',
    hora_desde: null, hora_hasta: null, motivo: null,
    created_at: '', updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  mockedGetAll.mockReset();
  mockedCreate.mockReset();
  mockedDelete.mockReset();
  useBloqueosAgendaStore.setState({ bloqueos: [], loading: false, error: null });
});

describe('useBloqueosAgendaStore', () => {
  it('fetchBloqueos() puebla el estado con lo que devuelve el servicio', async () => {
    const bloqueos = [buildBloqueo({ id: 1 }), buildBloqueo({ id: 2 })];
    mockedGetAll.mockResolvedValue(bloqueos);

    await useBloqueosAgendaStore.getState().fetchBloqueos();

    expect(useBloqueosAgendaStore.getState().bloqueos).toEqual(bloqueos);
    expect(useBloqueosAgendaStore.getState().loading).toBe(false);
  });

  it('agregarBloqueo() agrega el bloqueo creado a la lista existente', async () => {
    useBloqueosAgendaStore.setState({ bloqueos: [buildBloqueo({ id: 1 })] });
    const nuevo = buildBloqueo({ id: 2, profesional_id: 5 });
    mockedCreate.mockResolvedValue(nuevo);
    mockedGetAll.mockResolvedValue([buildBloqueo({ id: 1 }), nuevo]);

    const result = await useBloqueosAgendaStore.getState().agregarBloqueo({ fecha: '2099-06-15' });

    expect(result.success).toBe(true);
    expect(useBloqueosAgendaStore.getState().bloqueos.map(b => b.id)).toEqual([1, 2]);
  });

  it('eliminarBloqueo() quita el bloqueo borrado de la lista', async () => {
    useBloqueosAgendaStore.setState({ bloqueos: [buildBloqueo({ id: 1 }), buildBloqueo({ id: 2 })] });
    mockedDelete.mockResolvedValue(undefined);
    mockedGetAll.mockResolvedValue([buildBloqueo({ id: 2 })]);

    const result = await useBloqueosAgendaStore.getState().eliminarBloqueo(1);

    expect(result.success).toBe(true);
    expect(useBloqueosAgendaStore.getState().bloqueos.map(b => b.id)).toEqual([2]);
  });

  it('agregarBloqueo() surfacea el mensaje de error del backend en un fallo (ej. 409 duplicado)', async () => {
    mockedCreate.mockRejectedValue({ response: { data: { message: 'Ya existe un bloqueo idéntico para esa fecha.' } } });

    const result = await useBloqueosAgendaStore.getState().agregarBloqueo({ fecha: '2099-06-15' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Ya existe un bloqueo idéntico para esa fecha.');
  });
});
