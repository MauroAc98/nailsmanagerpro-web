import { describe, expect, it, vi } from 'vitest';

// Mismo criterio de aislamiento que profesionalService.test.ts: se mockea
// `@/lib/api`, sin red real.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/lib/api';
import { bloqueoAgendaService, type BloqueoAgenda, type CreateBloqueoAgendaDto } from './bloqueoAgendaService';

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);
const mockedDelete = vi.mocked(api.delete);

function buildBloqueo(overrides: Partial<BloqueoAgenda> = {}): BloqueoAgenda {
  return {
    id: 1, user_id: 1, profesional_id: null, fecha: '2099-01-01',
    hora_desde: null, hora_hasta: null, motivo: null,
    created_at: '', updated_at: '',
    ...overrides,
  };
}

describe('bloqueoAgendaService', () => {
  it('getAll() pega a GET /bloqueos y devuelve el array tal cual', async () => {
    const bloqueos = [buildBloqueo({ id: 1 }), buildBloqueo({ id: 2, profesional_id: 5 })];
    mockedGet.mockResolvedValue({ data: bloqueos });

    const result = await bloqueoAgendaService.getAll();

    expect(mockedGet).toHaveBeenCalledWith('/bloqueos');
    expect(result).toEqual(bloqueos);
  });

  it('create() pega a POST /bloqueos con el dto y devuelve el bloqueo creado', async () => {
    const dto: CreateBloqueoAgendaDto = {
      profesional_id: 5, fecha: '2099-06-15', hora_desde: '13:00', hora_hasta: '18:00', motivo: 'Vacaciones',
    };
    const creado = buildBloqueo({ id: 9, ...dto });
    mockedPost.mockResolvedValue({ data: creado });

    const result = await bloqueoAgendaService.create(dto);

    expect(mockedPost).toHaveBeenCalledWith('/bloqueos', dto);
    expect(result).toEqual(creado);
  });

  it('delete() pega a DELETE /bloqueos/{id}', async () => {
    mockedDelete.mockResolvedValue({ data: { message: 'ok' } });

    await bloqueoAgendaService.delete(9);

    expect(mockedDelete).toHaveBeenCalledWith('/bloqueos/9');
  });
});
