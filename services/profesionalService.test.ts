import { describe, expect, it, vi } from 'vitest';

// Sin red real — se mockea `@/lib/api` (mismo criterio de aislamiento que
// los tests de store, que mockean la capa de servicio un nivel más arriba).
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 1, avatar_url: null } }),
  },
}));

import api from '@/lib/api';
import { profesionalService, type CreateProfesionalDto, type UpdateProfesionalDto } from './profesionalService';

const mockedPost = vi.mocked(api.post);
const mockedPut = vi.mocked(api.put);
const mockedDelete = vi.mocked(api.delete);

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

describe('profesionalService — avatar', () => {
  it('subirAvatar postea multipart a /profesionales/{id}/avatar sin forzar Content-Type', async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: 5, avatar_url: 'https://cdn.test/avatar.png' } });
    const archivo = new File(['x'], 'avatar.png', { type: 'image/png' });
    const profesional = await profesionalService.subirAvatar(5, archivo);
    expect(mockedPost).toHaveBeenCalledWith(
      '/profesionales/5/avatar',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': undefined } }),
    );
    const form = mockedPost.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get('imagen')).toBe(archivo);
    expect(profesional.avatar_url).toBe('https://cdn.test/avatar.png');
  });

  it('borrarAvatar pega DELETE a /profesionales/{id}/avatar', async () => {
    const profesional = await profesionalService.borrarAvatar(5);
    expect(mockedDelete).toHaveBeenCalledWith('/profesionales/5/avatar');
    expect(profesional.avatar_url).toBeNull();
  });
});
