import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for "Editar servicio". Network boundary = the services
// (mocked); stores are the real zustand ones so the page wiring is exercised.
vi.mock('next/navigation', async () => ({
  ...(await import('@/test/mocks/nextNavigation')).nextNavigationMock,
  useParams: () => ({ id: '7' }),
}));
vi.mock('@/services/servicioService', async (orig) => ({
  ...(await orig<typeof import('@/services/servicioService')>()),
  servicioService: {
    getAll: vi.fn(), getOne: vi.fn(), update: vi.fn(), guardarComponentes: vi.fn(),
  },
}));
vi.mock('@/services/profesionalService', async (orig) => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: { getAll: vi.fn() },
}));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/reservaOnline/EntradaFotosServicio', () => ({ EntradaFotosServicio: () => null }));

import { servicioService, type Servicio } from '@/services/servicioService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';
import EditarServicioPage from '@/app/(app)/configuracion/servicios/[id]/page';

const servicio = (over: Partial<Servicio>): Servicio => ({
  id: 7, user_id: 1, nombre: 'Combo', duracion_minutos: 60, precio: '15000', activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '', ...over,
});
const profesional = (id: number, nombre: string, servicios: Servicio[], activo = true): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo, servicios } as Profesional);

const softgel = servicio({ id: 1, nombre: 'Softgel', duracion_minutos: 60, precio: '13000' });
const semis = servicio({ id: 2, nombre: 'Semis pies', duracion_minutos: 45, precio: '9000' });

// Boots the page with the given catalog (the edited servicio is id 7).
function montar(editado: Servicio, profesionales: Profesional[] = [], detalle: Partial<Servicio> = {}) {
  const catalogo = [editado, softgel, semis];
  useServiciosStore.setState({ servicios: catalogo });
  useProfesionalStore.setState({ profesionales });
  vi.mocked(servicioService.getAll).mockResolvedValue(catalogo);
  vi.mocked(servicioService.getOne).mockResolvedValue({ ...editado, ...detalle });
  vi.mocked(servicioService.update).mockResolvedValue(editado);
  vi.mocked(profesionalService.getAll).mockResolvedValue(profesionales);
  return renderWithProviders(<EditarServicioPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
});

describe('EditarServicioPage — legacy form is unchanged (Rule L)', () => {
  it('non-promo servicio: no components section, saves exactly the legacy payload', async () => {
    montar(servicio({}));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.update).toHaveBeenCalledWith(7, {
      nombre: 'Combo', duracion_minutos: 60, precio: 15000, es_promo: false, categoria_id: null,
    });
    expect(servicioService.getOne).not.toHaveBeenCalled();
    expect(servicioService.guardarComponentes).not.toHaveBeenCalled();
    expect(screen.queryByText('Servicios que incluye')).not.toBeInTheDocument();
  });

  it('legacy promo without components (2 professionals): no section content, no components call on save', async () => {
    const promo = servicio({ es_promo: true });
    montar(promo, [profesional(1, 'Ana', [softgel]), profesional(2, 'Laura', [semis])], { componentes: [], problemas: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.update).toHaveBeenCalledWith(7, expect.objectContaining({ es_promo: true, duracion_minutos: 60, precio: 15000 }));
    expect(servicioService.guardarComponentes).not.toHaveBeenCalled();
  });
});
