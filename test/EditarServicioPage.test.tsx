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

import { alertDialog } from '@/store/useConfirmStore';
import { servicioService, type Servicio } from '@/services/servicioService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';

// Test-only helper: only `atiende_en_paralelo` matters for these cases, the
// rest of `User`'s required fields are irrelevant noise for this screen.
const conAtiendeEnParalelo = (atiende_en_paralelo: boolean): User => ({ atiende_en_paralelo } as unknown as User);
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
  // clearAllMocks only clears call history, not a previously configured
  // reject/resolve — reset explicitly so one test's error case never leaks
  // into the next test's happy path.
  vi.mocked(servicioService.guardarComponentes).mockReset();
  return renderWithProviders(<EditarServicioPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  useAuthStore.setState({ user: null });
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

const ana = profesional(1, 'Ana', [softgel]);
const laura = profesional(2, 'Laura', [semis]);
const marta = profesional(3, 'Marta', [softgel]);
const promo = servicio({ es_promo: true });
const comp = (orden: number, servicio_id: number, profesional_id: number) => ({
  orden, servicio_id, nombre: '', duracion_minutos: 30, precio: '1000', profesional_id, profesional_nombre: '',
});
const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
// Pill accessible name = avatar initials + name ("AN Ana").
const pill = (nombre: string) => screen.getByRole('button', { name: new RegExp(`${nombre}$`) });

describe('EditarServicioPage — components section (multi-professional promo)', () => {
  it('shows the saved components of a promo with their service and professional', async () => {
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    const selects = await screen.findAllByRole('combobox');
    expect(selects.map(s => (s as HTMLSelectElement).value)).toEqual(['1', '2']);
    expect(pill('Ana')).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays hidden with a single active professional and no components', async () => {
    montar(promo, [ana], { componentes: [], problemas: [] });
    await screen.findByRole('button', { name: 'Guardar cambios' });
    expect(screen.queryByText('Servicios que incluye')).not.toBeInTheDocument();
  });

  it('picks service and professional per row and saves them in order', async () => {
    montar(promo, [ana, laura, marta], { componentes: [], problemas: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar servicio' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    // Ana and Marta both offer Softgel: nothing is auto-picked, Laura is not offered.
    expect(pill('Ana')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /Laura$/ })).not.toBeInTheDocument();
    fireEvent.click(pill('Marta'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '2' } });
    // Laura is the only one offering Semis pies: auto-picked.
    expect(pill('Laura')).toHaveAttribute('aria-pressed', 'true');
    guardar();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalled());
    expect(servicioService.guardarComponentes).toHaveBeenCalledWith(7, {
      modo_promo: 'secuencia', precio: null,
      componentes: [{ servicio_id: 1, profesional_id: 3 }, { servicio_id: 2, profesional_id: 2 }],
    });
  });

  it('removes a row with the X button', async () => {
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    await screen.findAllByRole('combobox');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar servicio' })[0]);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('refuses to save a half-filled row', async () => {
    montar(promo, [ana, laura, marta], { componentes: [], problemas: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar servicio' }));
    // Ana and Marta both offer Softgel: nothing is auto-picked, row stays half-filled.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    guardar();
    await waitFor(() => expect(alertDialog).toHaveBeenCalled());
    expect(servicioService.update).not.toHaveBeenCalled();
  });

  it('shows a saved problema message inline for its row', async () => {
    montar(promo, [ana, laura], {
      componentes: [comp(1, 1, 1), comp(2, 2, 2)],
      problemas: [{ codigo: 'profesional_inactiva', orden: 2, profesional_id: 2, servicio_id: 2, mensaje: 'Laura está inactiva' }],
    });
    expect(await screen.findByText('Laura está inactiva')).toBeInTheDocument();
  });

  it('maps a 422 componentes.{i} error to its row instead of a generic dialog', async () => {
    montar(promo, [ana, laura, marta], { componentes: [], problemas: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar servicio' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    fireEvent.click(pill('Marta'));
    vi.mocked(servicioService.guardarComponentes).mockRejectedValue({
      response: { data: { message: 'x', errors: { 'componentes.0.profesional_id': ['Marta no ofrece Softgel'] } } },
    });
    guardar();
    expect(await screen.findByText('Marta no ofrece Softgel')).toBeInTheDocument();
    expect(alertDialog).not.toHaveBeenCalled();
  });

});

describe('EditarServicioPage — mode, reorder, derived duration/price (2b-iii)', () => {
  it('paralelo is disabled with a hint when the studio setting is off, even with 2+ active professionals', async () => {
    useAuthStore.setState({ user: conAtiendeEnParalelo(false) });
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    expect(await screen.findByRole('button', { name: 'A la vez' })).toBeDisabled();
    expect(screen.getByText(/Activá "Atiende en paralelo"/)).toBeInTheDocument();
  });

  it('paralelo is enabled with the setting on and switching to it hides reorder controls and order numbers', async () => {
    useAuthStore.setState({ user: conAtiendeEnParalelo(true) });
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    expect((await screen.findAllByRole('button', { name: 'Subir en el orden' }))).toHaveLength(2);
    expect(screen.getByLabelText('Posición 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A la vez' }));
    expect(screen.queryByRole('button', { name: 'Subir en el orden' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Posición 1')).not.toBeInTheDocument();
  });

  it('reorders rows with the down arrow and sends precio null (empty field defaults to the sum)', async () => {
    useAuthStore.setState({ user: conAtiendeEnParalelo(false) });
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Bajar en el orden' }))[0]);
    guardar();
    await waitFor(() => expect(servicioService.guardarComponentes).toHaveBeenCalled());
    expect(servicioService.guardarComponentes).toHaveBeenCalledWith(7, {
      modo_promo: 'secuencia', precio: null,
      componentes: [{ servicio_id: 2, profesional_id: 2 }, { servicio_id: 1, profesional_id: 1 }],
    });
  });

});

describe('EditarServicioPage — derived duration, price override, turn-off cleanup (2b-iv)', () => {
  it('shows the derived duration and hides the legacy duration/price inputs once a row is fully chosen', async () => {
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    expect(await screen.findByText('Duración calculada: 105 min')).toBeInTheDocument();
    expect(screen.queryByText('Duración *')).not.toBeInTheDocument();
    expect(screen.queryByText('Precio (opcional)')).not.toBeInTheDocument();
  });

  it('keeps legacy duration/price visible for a promo with zero components', async () => {
    montar(promo, [ana, laura], { componentes: [], problemas: [] });
    await screen.findByRole('button', { name: 'Guardar cambios' });
    expect(screen.getByText('Duración *')).toBeInTheDocument();
    expect(screen.getByText('Precio (opcional)')).toBeInTheDocument();
  });

  it('sends the typed override when the price field differs from the component sum', async () => {
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    const precioInput = await screen.findByLabelText('Precio de la promo');
    fireEvent.change(precioInput, { target: { value: '18000' } });
    guardar();
    await waitFor(() => expect(servicioService.guardarComponentes).toHaveBeenCalled());
    expect(servicioService.guardarComponentes).toHaveBeenCalledWith(7, {
      modo_promo: 'secuencia', precio: 18000,
      componentes: [{ servicio_id: 1, profesional_id: 1 }, { servicio_id: 2, profesional_id: 2 }],
    });
  });

  it('sends componentes: [] before turning off es_promo on a promo with saved components', async () => {
    montar(promo, [ana, laura], { componentes: [comp(1, 1, 1), comp(2, 2, 2)], problemas: [] });
    await screen.findAllByRole('combobox');
    vi.mocked(servicioService.guardarComponentes).mockResolvedValue(promo);
    fireEvent.click(screen.getByRole('switch'));
    guardar();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalled());
    expect(servicioService.guardarComponentes).toHaveBeenCalledWith(7, {
      modo_promo: 'secuencia', precio: null, componentes: [],
    });
    const guardarOrder = vi.mocked(servicioService.guardarComponentes).mock.invocationCallOrder[0];
    const updateOrder = vi.mocked(servicioService.update).mock.invocationCallOrder[0];
    expect(guardarOrder).toBeLessThan(updateOrder);
  });
});
