import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for "Nuevo servicio". Network boundary = the services
// (mocked); stores are the real zustand ones so the page wiring is exercised.
vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/services/servicioService', async (orig) => ({
  ...(await orig<typeof import('@/services/servicioService')>()),
  servicioService: { getAll: vi.fn(), create: vi.fn(), guardarComponentes: vi.fn() },
}));
vi.mock('@/services/profesionalService', async (orig) => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: { getAll: vi.fn() },
}));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: vi.fn().mockResolvedValue(undefined) }));

import { alertDialog } from '@/store/useConfirmStore';
import { servicioService, type Servicio } from '@/services/servicioService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';
import NuevoServicioPage from '@/app/(app)/configuracion/servicios/nuevo/page';

const servicio = (over: Partial<Servicio>): Servicio => ({
  id: 1, user_id: 1, nombre: 'Softgel', duracion_minutos: 60, precio: '13000', activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '', ...over,
});
const profesional = (id: number, nombre: string, servicios: Servicio[]): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo: true, servicios } as Profesional);

const softgel = servicio({ id: 1, nombre: 'Softgel', duracion_minutos: 60, precio: '13000' });
const semis = servicio({ id: 2, nombre: 'Semis pies', duracion_minutos: 45, precio: '9000' });
const ana = profesional(1, 'Ana', [softgel]);
const laura = profesional(2, 'Laura', [semis]);
const NUEVO_ID = 9;

function montar(profesionales: Profesional[] = []) {
  const catalogo = [softgel, semis];
  useServiciosStore.setState({ servicios: catalogo });
  useProfesionalStore.setState({ profesionales });
  vi.mocked(servicioService.getAll).mockResolvedValue(catalogo);
  vi.mocked(servicioService.create).mockResolvedValue(servicio({ id: NUEVO_ID, es_promo: true }));
  vi.mocked(profesionalService.getAll).mockResolvedValue(profesionales);
  vi.mocked(servicioService.guardarComponentes).mockReset();
  return renderWithProviders(<NuevoServicioPage />);
}

const escribirNombre = async (nombre: string) =>
  fireEvent.change(await screen.findByPlaceholderText('Ej: Kapping'), { target: { value: nombre } });
const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }));
const toggle = () => fireEvent.click(screen.getByRole('switch'));

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  useAuthStore.setState({ user: null });
});

describe('NuevoServicioPage — legacy form is unchanged (Rule L)', () => {
  it('normal servicio: creates with the legacy payload and never calls components', async () => {
    montar([ana, laura]);
    await escribirNombre('Nuevo');
    guardar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.create).toHaveBeenCalledWith({
      nombre: 'Nuevo', duracion_minutos: 30, precio: undefined, es_promo: false, categoria_id: null,
    });
    expect(servicioService.guardarComponentes).not.toHaveBeenCalled();
  });

  it('promo without components: creates the plain promo and never calls components', async () => {
    montar([ana, laura]);
    await escribirNombre('Combo');
    toggle();
    guardar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.create).toHaveBeenCalledWith({
      nombre: 'Combo', duracion_minutos: 30, precio: undefined, es_promo: true, categoria_id: null,
    });
    expect(servicioService.guardarComponentes).not.toHaveBeenCalled();
    expect(alertDialog).not.toHaveBeenCalled();
  });
});

