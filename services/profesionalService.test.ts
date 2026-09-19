import { describe, expect, it, vi } from 'vitest';

// Sin red real — se mockea `@/lib/api` (mismo criterio de aislamiento que
// los tests de store, que mockean la capa de servicio un nivel más arriba).
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

import api from '@/lib/api';
import { profesionalService, type CreateProfesionalDto, type UpdateProfesionalDto } from './profesionalService';

const mockedPost = vi.mocked(api.post);
const mockedPut = vi.mocked(api.put);

describe('profesionalService — dias_atencion round-trip', () => {
  it('create() reenvía dias_atencion en el body del POST', async () => {
    const dto: CreateProfesionalDto = { nombre: 'Ana', dias_atencion: [1, 2, 3] };
    await profesionalService.create(dto);
    expect(mockedPost).toHaveBeenCalledWith('/profesionales', dto);
  });

  it('update() reenvía dias_atencion: null en el body del PUT (vuelve a "todos los días")', async () => {
    const dto: UpdateProfesionalDto = { dias_atencion: null };
    await profesionalService.update(5, dto);
    expect(mockedPut).toHaveBeenCalledWith('/profesionales/5', dto);
  });
});
