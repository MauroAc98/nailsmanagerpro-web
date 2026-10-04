import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent, within } from '@/test/render';

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
vi.mock('@/services/slotService', () => ({ slotService: { getAll: vi.fn() } }));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: vi.fn().mockResolvedValue(undefined) }));

import { alertDialog } from '@/store/useConfirmStore';
import { servicioService, type Servicio } from '@/services/servicioService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { slotService } from '@/services/slotService';
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
  // By default every person has active horarios.
  vi.mocked(slotService.getAll).mockResolvedValue([{ id: 1, user_id: 1, hora: '10:00', activo: true }]);
  return renderWithProviders(<NuevoServicioPage />);
}

const escribirNombre = async (nombre: string) =>
  fireEvent.change(await screen.findByPlaceholderText('Ej: Kapping'), { target: { value: nombre } });
// The components section's own "Agregar servicio" button sits above the submit one.
const guardar = () => fireEvent.click(screen.getAllByRole('button', { name: 'Agregar servicio' }).at(-1)!);
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


// Service / person pickers are bottom sheets (role=dialog) opened from each card.
const elegirServicio = async (nombre: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Elegí un servicio' }));
  fireEvent.click(await within(screen.getByRole('dialog')).findByText(nombre));
};

// Adds one Softgel row; Ana is its only offerer, so she is auto-picked.
async function agregarFilaSoftgel() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Agregar servicio' }))[0]);
  await elegirServicio('Softgel');
}

describe('NuevoServicioPage — components section for a new promo', () => {
  it('hidden until the promo toggle is on, and switching it off discards the rows', async () => {
    montar([ana, laura]);
    await escribirNombre('Combo');
    expect(screen.queryByText('Servicios que incluye')).not.toBeInTheDocument();

    toggle();
    await agregarFilaSoftgel();
    expect(screen.getAllByRole('button', { name: 'Quitar servicio' })).toHaveLength(1);

    toggle();
    expect(screen.queryByText('Servicios que incluye')).not.toBeInTheDocument();
    guardar();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.create).toHaveBeenCalledWith(expect.objectContaining({ es_promo: false, duracion_minutos: 30 }));
    expect(servicioService.guardarComponentes).not.toHaveBeenCalled();
  });

  it('creates the promo and then saves the components with the new id', async () => {
    montar([ana, laura]);
    await escribirNombre('Combo');
    toggle();
    await agregarFilaSoftgel();
    guardar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/configuracion/servicios'));
    expect(servicioService.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Combo', es_promo: true }));
    expect(servicioService.guardarComponentes).toHaveBeenCalledWith(NUEVO_ID, {
      modo_promo: 'secuencia', precio: null, componentes: [{ servicio_id: 1, profesional_id: 1 }],
    });
  });

  it('keeps the promo and sends the user to its edit screen when the components call fails', async () => {
    montar([ana, laura]);
    vi.mocked(servicioService.guardarComponentes).mockRejectedValue(new Error('boom'));
    await escribirNombre('Combo');
    toggle();
    await agregarFilaSoftgel();
    guardar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith(`/configuracion/servicios/${NUEVO_ID}`));
    expect(servicioService.create).toHaveBeenCalledTimes(1);
    expect(alertDialog).toHaveBeenCalledWith(expect.stringContaining('Se creó la promoción'));
    expect(routerMock.push).not.toHaveBeenCalledWith('/configuracion/servicios');
  });

  it('refuses to save while a row is half filled', async () => {
    // Two people offer Softgel, so nothing is auto-picked and the row stays half filled.
    montar([ana, profesional(3, 'Marta', [softgel])]);
    await escribirNombre('Combo');
    toggle();
    await agregarFilaSoftgel();
    guardar();

    await waitFor(() => expect(alertDialog).toHaveBeenCalledWith('Completá el servicio y quién lo hace en cada fila antes de guardar.'));
    expect(servicioService.create).not.toHaveBeenCalled();
  });
});

describe('NuevoServicioPage — person without horarios (assignment time)', () => {
  const sinHorarios = (idSinHorarios: number) =>
    vi.mocked(slotService.getAll).mockImplementation(async (id?: number) =>
      (id === idSinHorarios ? [] : [{ id: 1, user_id: 1, hora: '10:00', activo: true }]));

  it('shows a calm note inside the card, does not block, and links to Horarios Disponibles', async () => {
    montar([ana, laura]);
    sinHorarios(2);
    await escribirNombre('Combo');
    toggle();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Agregar servicio' }))[0]);
    await elegirServicio('Semis pies');

    expect(await screen.findByText('Laura todavía no tiene horarios cargados')).toBeInTheDocument();
    expect(screen.getByText('Podés agendar esta promo desde la agenda, pero no se va a poder reservar online.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar horarios' }));
    expect(routerMock.push).toHaveBeenCalledWith('/configuracion/slots');
  });

  it('shows no note for a person that has active horarios', async () => {
    montar([ana, laura]);
    await escribirNombre('Combo');
    toggle();
    await agregarFilaSoftgel();
    await screen.findByText('Ana');
    expect(screen.queryByText(/todavía no tiene horarios cargados/)).not.toBeInTheDocument();
  });

  it('tags the person in the picker sheet with "Sin horarios" but still lets you choose them', async () => {
    const marta = profesional(3, 'Marta', [softgel]);
    montar([ana, marta]);
    sinHorarios(3);
    await escribirNombre('Combo');
    toggle();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Agregar servicio' }))[0]);
    await elegirServicio('Softgel');
    fireEvent.click(screen.getByRole('button', { name: 'Elegí quién lo hace' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(await dialog.findByText('Sin horarios')).toBeInTheDocument();
    fireEvent.click(dialog.getByText('Marta'));
    expect(await screen.findByText('Marta todavía no tiene horarios cargados')).toBeInTheDocument();
  });
});
