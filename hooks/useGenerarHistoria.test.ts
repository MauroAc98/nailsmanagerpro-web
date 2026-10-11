import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
vi.mock('@/lib/historia/captura', () => ({
  fetchAsDataUrl: async () => 'data:image/png;base64,eA==',
  prepararImagenesParaCaptura: async () => new Map(),
  hornearFotoEncabezado: async (url: string) => `data:horneada,${url}`,
  resizeFondoFile: async (file: File) => ({ dataUrl: 'data:image/png;base64,eA==', file }),
}));
vi.mock('@/services/turnoService', async orig => ({
  ...(await orig<typeof import('@/services/turnoService')>()),
  turnoService: { getDisponibilidad: vi.fn(async () => []) },
}));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: {
    getAll: vi.fn(async () => []),
    subirFondoHistoria: vi.fn(),
    borrarFondoHistoria: vi.fn(),
  },
}));
vi.mock('@/services/profesionalService', async orig => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: {
    subirFondoHistoria: vi.fn(),
    borrarFondoHistoria: vi.fn(),
  },
}));
vi.mock('@/store/useConfirmStore', async orig => ({
  ...(await orig<typeof import('@/store/useConfirmStore')>()),
  alertDialog: vi.fn(async () => {}),
}));

import { turnoService } from '@/services/turnoService';
import { categoriaServicioService, type CategoriaServicio } from '@/services/categoriaServicioService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGenerarHistoria } from './useGenerarHistoria';

function profesional(overrides: Partial<Profesional>): Profesional {
  return {
    id: 1, user_id: 1, nombre: 'Jefa', apellido: null, nombre_completo: 'Jefa', color: null,
    activo: true, servicios: [], fondo_historia_url: 'https://cdn.test/fondo-prof.jpg',
    avatar_url: 'https://cdn.test/avatar.jpg', historia_precios_template_id: null,
    historia_precios_fotos: [], historia_precios_nota: null, dias_atencion: null,
    ...overrides,
  };
}

function categoria(overrides: Partial<CategoriaServicio>): CategoriaServicio {
  return {
    id: 10, user_id: 1, nombre: 'Uñas', fondo_historia_url: 'https://cdn.test/fondo-cat.jpg',
    created_at: '', updated_at: '', ...overrides,
  };
}

const getDisp = vi.mocked(turnoService.getDisponibilidad);

describe('useGenerarHistoria — categoría', () => {
  beforeEach(() => {
    getDisp.mockClear();
    vi.mocked(categoriaServicioService.subirFondoHistoria).mockReset();
    vi.mocked(categoriaServicioService.borrarFondoHistoria).mockReset();
    vi.mocked(profesionalService.subirFondoHistoria).mockReset();
    useAuthStore.setState({ user: { name: 'Estudio', logo_url: 'https://cdn.test/logo.jpg' } } as never);
    useProfesionalStore.setState({
      profesionales: [profesional({ id: 1 }), profesional({ id: 2, nombre: 'Otra' })],
    });
    useCategoriasServicioStore.setState({
      categorias: [categoria({ id: 10 }), categoria({ id: 11, nombre: 'Pestañas', fondo_historia_url: null })],
    });
  });

  it('"Todas" (null) es el default: pide con la profesional efectiva, sin categoría', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    await waitFor(() => expect(getDisp).toHaveBeenCalled());
    expect(result.current.selectedCategoriaId).toBeNull();
    expect(getDisp.mock.calls.at(-1)?.[2]).toBe(1);
    expect(getDisp.mock.calls.at(-1)?.[3]).toBeUndefined();
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-prof.jpg');
  });

  it('al elegir una categoría pide con categoriaId y sin profesional', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    await waitFor(() => expect(getDisp).toHaveBeenCalled());
    act(() => result.current.setSelectedCategoriaId(10));
    await waitFor(() => expect(getDisp.mock.calls.at(-1)?.[3]).toBe(10));
    expect(getDisp.mock.calls.at(-1)?.[2]).toBeUndefined();
  });

  it('con categoría, el fondo guardado es el de la categoría y el encabezado usa el logo (no el avatar)', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setSelectedCategoriaId(10));
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-cat.jpg');
    await waitFor(() => expect(result.current.logoUrl).toContain(encodeURIComponent('https://cdn.test/logo.jpg')));
    expect(result.current.logoUrl).not.toContain(encodeURIComponent('https://cdn.test/avatar.jpg'));
    await waitFor(() => expect(result.current.fondoUri).toBe('data:image/png;base64,eA=='));
  });

  it('cambiar de categoría resetea días y horarios ocultos', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => { result.current.setDiasOcultos(['2026-10-10']); result.current.setSlotsOcultos(['2026-10-10|10hs']); });
    act(() => result.current.setSelectedCategoriaId(11));
    expect(result.current.diasOcultos).toEqual([]);
    expect(result.current.slotsOcultos).toEqual([]);
  });

  it('elegirFoto(file, true) con categoría sube a los endpoints de categoría, no a los de profesional', async () => {
    vi.mocked(categoriaServicioService.subirFondoHistoria).mockResolvedValue(
      categoria({ id: 10, fondo_historia_url: 'https://cdn.test/nuevo.jpg' }),
    );
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setSelectedCategoriaId(10));
    const file = new File(['x'], 'f.png', { type: 'image/png' });
    act(() => result.current.elegirFoto(file, true));
    await waitFor(() => expect(categoriaServicioService.subirFondoHistoria).toHaveBeenCalledWith(10, file));
    expect(profesionalService.subirFondoHistoria).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(useCategoriasServicioStore.getState().categorias.find(c => c.id === 10)?.fondo_historia_url)
        .toBe('https://cdn.test/nuevo.jpg'));
  });

  it('quitarFondoFijo con categoría borra por el endpoint de categoría', async () => {
    vi.mocked(categoriaServicioService.borrarFondoHistoria).mockResolvedValue(
      categoria({ id: 10, fondo_historia_url: null }),
    );
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setSelectedCategoriaId(10));
    await act(async () => { await result.current.quitarFondoFijo(); });
    expect(categoriaServicioService.borrarFondoHistoria).toHaveBeenCalledWith(10);
    expect(result.current.fondoUri).toBeNull();
  });
});
