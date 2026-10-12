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
import type { Servicio } from '@/services/servicioService';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { useServiciosStore } from '@/store/useServicioStore';
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

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1, user_id: 1, nombre: 'Servicio', duracion_minutos: 30, precio: null, activo: true,
    es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '',
    ...overrides,
  };
}

const getDisp = vi.mocked(turnoService.getDisponibilidad);
const ultimo = () => getDisp.mock.calls.at(-1);

const S_UNAS_A = servicio({ id: 101, nombre: 'Esmaltado', categoria_id: 10, orden: 1 });
const S_UNAS_B = servicio({ id: 102, nombre: 'Kapping', categoria_id: 10, orden: 0 });
const S_PEST   = servicio({ id: 103, nombre: 'Lifting', categoria_id: 11, orden: 0 });
const S_OFF    = servicio({ id: 104, nombre: 'Inactivo', categoria_id: 10, activo: false });

function setup(opts: { profesionales?: Profesional[] } = {}) {
  getDisp.mockClear();
  vi.mocked(categoriaServicioService.subirFondoHistoria).mockReset();
  vi.mocked(categoriaServicioService.borrarFondoHistoria).mockReset();
  vi.mocked(profesionalService.subirFondoHistoria).mockReset();
  useAuthStore.setState({ user: { name: 'Estudio', logo_url: 'https://cdn.test/logo.jpg' } } as never);
  useProfesionalStore.setState({
    profesionales: opts.profesionales ?? [
      profesional({ id: 1, servicios: [S_UNAS_A, S_UNAS_B] }),
      profesional({ id: 2, nombre: 'Otra', fondo_historia_url: null, servicios: [S_PEST] }),
    ],
  });
  useCategoriasServicioStore.setState({
    categorias: [categoria({ id: 10 }), categoria({ id: 11, nombre: 'Pestañas', fondo_historia_url: null })],
  });
  useServiciosStore.setState({ servicios: [S_UNAS_A, S_UNAS_B, S_PEST, S_OFF] } as never);
}

describe('useGenerarHistoria — equipo y servicios', () => {
  beforeEach(() => setup());

  it('default: la jefa, sin equipo ni servicios; pide con su id', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    await waitFor(() => expect(getDisp).toHaveBeenCalled());
    expect(result.current.profesionalSel).toBe(1);
    expect(result.current.esEquipo).toBe(false);
    expect(result.current.effectiveProfesionalId).toBe(1);
    expect(ultimo()?.[2]).toBe(1);
    expect(ultimo()?.[3]).toBeUndefined();
  });

  it('equipo sin servicios elegidos: sin profesional y con TODOS los servicios activos', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    await waitFor(() => expect(ultimo()?.[2]).toBeUndefined());
    expect(ultimo()?.[3]).toEqual([101, 102, 103]);
    expect(result.current.esEquipo).toBe(true);
    expect(result.current.effectiveProfesionalId).toBeNull();
  });

  it('equipo con servicios elegidos: manda solo los elegidos', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([103]));
    await waitFor(() => expect(ultimo()?.[3]).toEqual([103]));
    expect(ultimo()?.[2]).toBeUndefined();
  });

  it('equipo sin ningún servicio activo en la cuenta: cae al pedido de siempre', async () => {
    useServiciosStore.setState({ servicios: [S_OFF] } as never);
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    await waitFor(() => expect(getDisp.mock.calls.length).toBeGreaterThan(1));
    expect(ultimo()?.[2]).toBeUndefined();
    expect(ultimo()?.[3]).toBeUndefined();
  });

  it('profesional elegida con servicios: manda profesional_id y los servicios', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101]));
    await waitFor(() => expect(ultimo()?.[3]).toEqual([101]));
    expect(ultimo()?.[2]).toBe(1);
  });

  it('servicios ofrecidos: los activos de la profesional; en equipo, todos los activos', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    expect(result.current.serviciosOfrecidos.map(s => s.id)).toEqual([101, 102]);
    act(() => result.current.setProfesionalSel(2));
    expect(result.current.serviciosOfrecidos.map(s => s.id)).toEqual([103]);
    act(() => result.current.setProfesionalSel('equipo'));
    expect(result.current.serviciosOfrecidos.map(s => s.id)).toEqual([101, 102, 103]);
  });

  it('cambiar de profesional descarta los servicios que no hace', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101, 102]));
    act(() => result.current.setProfesionalSel(2));
    expect(result.current.servicioIds).toEqual([]);
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([101, 103]));
    act(() => result.current.setProfesionalSel(1));
    expect(result.current.servicioIds).toEqual([101]);
  });

  it('cambiar servicios o profesional resetea días y horarios ocultos', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => { result.current.setDiasOcultos(['2026-10-10']); result.current.setSlotsOcultos(['2026-10-10|10hs']); });
    act(() => result.current.setServicioIds([101]));
    expect(result.current.diasOcultos).toEqual([]);
    expect(result.current.slotsOcultos).toEqual([]);
    act(() => { result.current.setDiasOcultos(['2026-10-10']); });
    act(() => result.current.setProfesionalSel('equipo'));
    expect(result.current.diasOcultos).toEqual([]);
  });

  it('serviciosElegidos sale en orden de categoría y luego orden del servicio', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([103, 101, 102]));
    expect(result.current.serviciosElegidos.map(s => s.id)).toEqual([102, 101, 103]);
  });

  it('en equipo el encabezado usa el logo del negocio, no un avatar', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    await waitFor(() => expect(result.current.logoUrl).toContain(encodeURIComponent('https://cdn.test/logo.jpg')));
    expect(result.current.logoUrl).not.toContain(encodeURIComponent('https://cdn.test/avatar.jpg'));
  });
});

describe('useGenerarHistoria — cuenta con una sola profesional', () => {
  beforeEach(() => setup({ profesionales: [profesional({ id: 1, servicios: [S_UNAS_A] })] }));

  it('sin servicios: pide sin filtros, como siempre', async () => {
    renderHook(() => useGenerarHistoria('2026-10-10'));
    await waitFor(() => expect(getDisp).toHaveBeenCalled());
    expect(ultimo()?.[2]).toBeUndefined();
    expect(ultimo()?.[3]).toBeUndefined();
  });

  it('con servicios elegidos agrega servicio_ids, sin profesional', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101]));
    await waitFor(() => expect(ultimo()?.[3]).toEqual([101]));
    expect(ultimo()?.[2]).toBeUndefined();
  });

  it('ignora el modo equipo (no hay selector)', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    expect(result.current.esEquipo).toBe(false);
  });
});

describe('useGenerarHistoria — fondo según servicios', () => {
  beforeEach(() => setup());

  it('sin servicios: el fondo es el de la profesional efectiva', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-prof.jpg');
  });

  it('todos de UNA categoría con fondo: usa el de la categoría', async () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101, 102]));
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-cat.jpg');
    await waitFor(() => expect(result.current.fondoUri).toBe('data:image/png;base64,eA=='));
  });

  it('una categoría sin fondo propio: cae al de la profesional (en equipo, la jefa)', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([103]));
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-prof.jpg');
  });

  it('categorías mezcladas: cae al de la profesional', () => {
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([101, 103]));
    expect(result.current.fondoFijoGuardado).toBe('https://cdn.test/fondo-prof.jpg');
  });

  it('elegirFoto(file, true) con una sola categoría sube al endpoint de categoría', async () => {
    vi.mocked(categoriaServicioService.subirFondoHistoria).mockResolvedValue(
      categoria({ id: 10, fondo_historia_url: 'https://cdn.test/nuevo.jpg' }),
    );
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101]));
    const file = new File(['x'], 'f.png', { type: 'image/png' });
    act(() => result.current.elegirFoto(file, true));
    await waitFor(() => expect(categoriaServicioService.subirFondoHistoria).toHaveBeenCalledWith(10, file));
    expect(profesionalService.subirFondoHistoria).not.toHaveBeenCalled();
  });

  it('elegirFoto(file, true) con categorías mezcladas sube a la profesional', async () => {
    vi.mocked(profesionalService.subirFondoHistoria).mockResolvedValue(profesional({ id: 1 }));
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setProfesionalSel('equipo'));
    act(() => result.current.setServicioIds([101, 103]));
    const file = new File(['x'], 'f.png', { type: 'image/png' });
    act(() => result.current.elegirFoto(file, true));
    await waitFor(() => expect(profesionalService.subirFondoHistoria).toHaveBeenCalledWith(1, file));
    expect(categoriaServicioService.subirFondoHistoria).not.toHaveBeenCalled();
  });

  it('quitarFondoFijo con una sola categoría borra por el endpoint de categoría', async () => {
    vi.mocked(categoriaServicioService.borrarFondoHistoria).mockResolvedValue(
      categoria({ id: 10, fondo_historia_url: null }),
    );
    const { result } = renderHook(() => useGenerarHistoria('2026-10-10'));
    act(() => result.current.setServicioIds([101]));
    await act(async () => { await result.current.quitarFondoFijo(); });
    expect(categoriaServicioService.borrarFondoHistoria).toHaveBeenCalledWith(10);
    expect(result.current.fondoUri).toBeNull();
  });
});
