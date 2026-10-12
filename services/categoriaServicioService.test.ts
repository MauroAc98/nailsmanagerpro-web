import { describe, expect, it, vi } from 'vitest';

// Sin red real — se mockea `@/lib/api`, mismo criterio que profesionalService.test.ts.
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { id: 3, fondo_historia_url: 'https://cdn.test/fondo.jpg' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 3, fondo_historia_url: null } }),
  },
}));

import api from '@/lib/api';
import { categoriaServicioService } from './categoriaServicioService';

describe('categoriaServicioService — fondo de historia', () => {
  it('subirFondoHistoria postea multipart (campo imagen) a /categorias-servicio/{id}/fondo-historia sin forzar Content-Type', async () => {
    const archivo = new File(['x'], 'fondo.png', { type: 'image/png' });
    const categoria = await categoriaServicioService.subirFondoHistoria(3, archivo);
    expect(api.post).toHaveBeenCalledWith(
      '/categorias-servicio/3/fondo-historia',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': undefined }, timeout: 60_000 }),
    );
    const form = vi.mocked(api.post).mock.calls.at(-1)?.[1] as FormData;
    expect(form.get('imagen')).toBe(archivo);
    expect(categoria.fondo_historia_url).toBe('https://cdn.test/fondo.jpg');
  });

  it('borrarFondoHistoria pega DELETE a /categorias-servicio/{id}/fondo-historia', async () => {
    const categoria = await categoriaServicioService.borrarFondoHistoria(3);
    expect(api.delete).toHaveBeenCalledWith('/categorias-servicio/3/fondo-historia');
    expect(categoria.fondo_historia_url).toBeNull();
  });
});
