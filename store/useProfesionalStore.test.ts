import { beforeEach, describe, expect, it, vi } from 'vitest';

// `subirAvatar`/`borrarAvatar` hablan con el backend via profesionalService
// — se mockea (mismo criterio que useServicioStore.test.ts con
// servicioService) para probar el reemplazo del profesional en el array sin
// red real.
vi.mock('@/services/profesionalService', async () => {
  const actual = await vi.importActual<typeof import('@/services/profesionalService')>('@/services/profesionalService');
  return {
    ...actual,
    profesionalService: {
      ...actual.profesionalService,
      subirAvatar: vi.fn(),
      borrarAvatar: vi.fn(),
    },
  };
});

import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useProfesionalStore } from './useProfesionalStore';

const mockedSubir = vi.mocked(profesionalService.subirAvatar);
const mockedBorrar = vi.mocked(profesionalService.borrarAvatar);

function profesional(id: number, avatar_url: string | null): Profesional {
  return {
    id, user_id: 1, nombre: `Prof ${id}`, apellido: null, nombre_completo: `Prof ${id}`,
    color: null, activo: true, servicios: [], fondo_historia_url: null,
    historia_precios_template_id: null, historia_precios_fotos: [], historia_precios_nota: null,
    dias_atencion: null, avatar_url,
  };
}

beforeEach(() => {
  mockedSubir.mockReset();
  mockedBorrar.mockReset();
  useProfesionalStore.setState({ profesionales: [profesional(1, null), profesional(2, null)], loading: false, error: null });
});

describe('useProfesionalStore.subirAvatar', () => {
  it('reemplaza al profesional actualizado con el avatar_url devuelto', async () => {
    mockedSubir.mockResolvedValue(profesional(1, 'https://cdn.test/a.png'));
    const archivo = new File(['x'], 'a.png', { type: 'image/png' });
    const result = await useProfesionalStore.getState().subirAvatar(1, archivo);
    expect(result).toEqual({ success: true });
    expect(mockedSubir).toHaveBeenCalledWith(1, archivo);
    expect(useProfesionalStore.getState().profesionales.find((p) => p.id === 1)?.avatar_url).toBe('https://cdn.test/a.png');
    // no toca al otro profesional
    expect(useProfesionalStore.getState().profesionales.find((p) => p.id === 2)?.avatar_url).toBeNull();
  });

  it('si falla, devuelve success:false y no modifica el estado', async () => {
    mockedSubir.mockRejectedValue(new Error('red'));
    const result = await useProfesionalStore.getState().subirAvatar(1, new File(['x'], 'a.png'));
    expect(result.success).toBe(false);
    expect(useProfesionalStore.getState().profesionales.find((p) => p.id === 1)?.avatar_url).toBeNull();
  });
});

describe('useProfesionalStore.borrarAvatar', () => {
  it('reemplaza al profesional actualizado con avatar_url en null', async () => {
    useProfesionalStore.setState({ profesionales: [profesional(1, 'https://cdn.test/a.png')], loading: false, error: null });
    mockedBorrar.mockResolvedValue(profesional(1, null));
    const result = await useProfesionalStore.getState().borrarAvatar(1);
    expect(result).toEqual({ success: true });
    expect(mockedBorrar).toHaveBeenCalledWith(1);
    expect(useProfesionalStore.getState().profesionales.find((p) => p.id === 1)?.avatar_url).toBeNull();
  });
});
