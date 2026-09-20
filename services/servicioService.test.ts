import { describe, expect, it, vi } from 'vitest';

// Sin red real — se mockea `@/lib/api` (mismo criterio de aislamiento que
// profesionalService.test.ts: la instancia `api` es el limite de red, no
// se mockea logica de negocio propia).
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: 5, fotos: [{ id: 1, url: 'https://cdn.test/a.jpg', orden: 0 }] } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 5, fotos: [] } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 5, fotos: [] } }),
  },
}));

import api from '@/lib/api';
import { servicioService } from './servicioService';

const mockedPost = vi.mocked(api.post);
const mockedDelete = vi.mocked(api.delete);
const mockedPatch = vi.mocked(api.patch);

describe('servicioService — fotos del portafolio (autenticado)', () => {
  it('subirFoto postea multipart a /servicios/{id}/fotos con Content-Type sin forzar (deja que el browser arme el boundary)', async () => {
    const archivo = new File(['x'], 'trabajo.jpg', { type: 'image/jpeg' });
    const servicio = await servicioService.subirFoto(5, archivo);
    expect(mockedPost).toHaveBeenCalledWith(
      '/servicios/5/fotos',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': undefined } }),
    );
    const form = mockedPost.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get('imagen')).toBe(archivo);
    expect(servicio.fotos).toEqual([{ id: 1, url: 'https://cdn.test/a.jpg', orden: 0 }]);
  });

  it('borrarFoto pega DELETE a /servicios/{id}/fotos/{fotoId}', async () => {
    const servicio = await servicioService.borrarFoto(5, 1);
    expect(mockedDelete).toHaveBeenCalledWith('/servicios/5/fotos/1');
    expect(servicio.fotos).toEqual([]);
  });

  it('reordenarFotos pega PATCH a /servicios/{id}/fotos/reordenar con {ids}', async () => {
    await servicioService.reordenarFotos(5, [3, 1, 2]);
    expect(mockedPatch).toHaveBeenCalledWith('/servicios/5/fotos/reordenar', { ids: [3, 1, 2] });
  });
});
