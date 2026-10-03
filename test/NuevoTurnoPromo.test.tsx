import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for "Nuevo turno" with a promo that has components (combo).
// Network boundary = the services; the stores are the real zustand ones, with
// their fetchers silenced so the page boots from the state set here.
vi.mock('next/navigation', async () => ({
  ...(await import('@/test/mocks/nextNavigation')).nextNavigationMock,
}));
vi.mock('@/services/servicioService', async (orig) => ({
  ...(await orig<typeof import('@/services/servicioService')>()),
  servicioService: { getAll: vi.fn(), getOne: vi.fn() },
}));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/store/useConfirmStore', () => ({
  alertDialog: vi.fn().mockResolvedValue(undefined),
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { servicioService, type Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import type { Cliente } from '@/services/clienteService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { resetNavigationMock, setMockLocation } from '@/test/mocks/nextNavigation';
import NuevoTurnoPage from '@/app/(app)/agenda/nuevo/page';

const servicio = (over: Partial<Servicio>): Servicio => ({
  id: 1, user_id: 1, nombre: 'Manicura', duracion_minutos: 30, precio: '5000', activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '', ...over,
});
const profesional = (id: number, nombre: string, servicios: Servicio[]): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo: true, dias_atencion: null, servicios } as unknown as Profesional);

const manicura = servicio({ id: 1 });
const softgel = servicio({ id: 2, nombre: 'Softgel', duracion_minutos: 60, precio: '13000' });
const semis = servicio({ id: 3, nombre: 'Semis pies', duracion_minutos: 45, precio: '9000' });
const combo = servicio({ id: 9, nombre: 'Combo pies y manos', es_promo: true, modo_promo: 'secuencia', duracion_minutos: 105, precio: '18000' });
const ana = profesional(1, 'Ana', [manicura, softgel]);
const laura = profesional(2, 'Laura', [manicura, semis]);
const marta: Cliente = { id: 5, nombre: 'Marta', apellido: 'Rios', telefono: '+543765252395', activo: true };

const comp = (orden: number, s: Servicio, p: Profesional) => ({
  orden, servicio_id: s.id, nombre: s.nombre, duracion_minutos: s.duracion_minutos, precio: s.precio, profesional_id: p.id, profesional_nombre: p.nombre,
});
const detalle = (over: Partial<Servicio> = {}): Servicio => ({
  ...combo, componentes: [comp(1, softgel, ana), comp(2, semis, laura)], problemas: [], ...over,
});

const crearTurno = vi.fn();

function montar(det: Servicio = detalle()) {
  setMockLocation('/agenda/nuevo', 'fecha=2099-06-10');
  vi.mocked(servicioService.getOne).mockResolvedValue(det);
  useServiciosStore.setState({ servicios: [manicura, softgel, semis, combo], fetchServicios: vi.fn() });
  useProfesionalStore.setState({ profesionales: [ana, laura], fetchProfesionales: vi.fn() });
  useClientesStore.setState({ clientes: [marta], fetchClientes: vi.fn() });
  useSlotsStore.setState({ slots: [{ id: 1, hora: '09:00', activo: true }, { id: 2, hora: '18:00', activo: true }] as never, fetchSlots: vi.fn(), loading: false, ultimoProfesionalIdSolicitado: 1 });
  useBloqueosAgendaStore.setState({ bloqueos: [], fetchBloqueos: vi.fn() });
  useTurnoStore.setState({ turnos: [], fetchTurnos: vi.fn(), crearTurno });
  return renderWithProviders(<NuevoTurnoPage />);
}

async function elegirClienteYServicio(nombreServicio: RegExp) {
  fireEvent.click(await screen.findByText('Seleccionar...'));
  fireEvent.click(await screen.findByText('Marta Rios'));
  fireEvent.click(await screen.findByRole('button', { name: nombreServicio }));
}
const confirmar = () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar Turno' }));

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  crearTurno.mockResolvedValue({ success: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2099-06-01T10:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('NuevoTurnoPage — turno comun (Rule L)', () => {
  it('con dos profesionales sigue pidiendo elegir una, no consulta la promo y manda el payload de siempre', async () => {
    montar();
    expect(await screen.findByText('PROFESIONAL')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ana$/ }));
    await elegirClienteYServicio(/^Manicura/);
    confirmar();

    await waitFor(() => expect(crearTurno).toHaveBeenCalledWith({
      cliente_id: 5, servicio_ids: [1], fecha_hora: '2099-06-10 10:00', profesional_id: 1,
    }));
    expect(servicioService.getOne).not.toHaveBeenCalled();
    expect(screen.queryByText('QUÉ SE AGENDA')).not.toBeInTheDocument();
  });
});

describe('NuevoTurnoPage — combo', () => {
  it('muestra cada servicio con su profesional y horario, sin pedir profesional ni mostrar jerga', async () => {
    montar();
    await elegirClienteYServicio(/^Combo pies y manos/);

    expect(await screen.findByText('Softgel · con Ana')).toBeInTheDocument();
    expect(screen.getByText('10:00 a 11:00')).toBeInTheDocument();
    expect(screen.getByText('Semis pies · con Laura')).toBeInTheDocument();
    expect(screen.getByText('11:00 a 11:45')).toBeInTheDocument();
    expect(screen.queryByText('PROFESIONAL')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia/i);
  });

  it('manda solo la promo (sin profesional) y el precio manual si se completo', async () => {
    montar();
    await elegirClienteYServicio(/^Combo pies y manos/);
    fireEvent.change(await screen.findByLabelText('Precio del combo (opcional)'), { target: { value: '15000' } });
    confirmar();

    await waitFor(() => expect(crearTurno).toHaveBeenCalledWith({
      cliente_id: 5, servicio_ids: [9], fecha_hora: '2099-06-10 10:00', precio_promo: 15000,
    }));
  });

  it('sin precio manual no manda precio_promo', async () => {
    montar();
    await elegirClienteYServicio(/^Combo pies y manos/);
    await screen.findByText('Softgel · con Ana');
    confirmar();

    await waitFor(() => expect(crearTurno).toHaveBeenCalledWith({ cliente_id: 5, servicio_ids: [9], fecha_hora: '2099-06-10 10:00' }));
  });

  it('avisa del bloqueo de CADA profesional del combo antes de agendar (mismo aviso del turno comun)', async () => {
    montar();
    useBloqueosAgendaStore.setState({
      bloqueos: [{ id: 1, user_id: 1, profesional_id: 2, fecha: '2099-06-10', hora_desde: '11:00', hora_hasta: '12:00', motivo: 'Capacitación', created_at: '', updated_at: '' }],
    });
    await elegirClienteYServicio(/^Combo pies y manos/);
    await screen.findByText('Softgel · con Ana');
    confirmar();

    await waitFor(() => expect(confirmDialog).toHaveBeenCalledTimes(1));
    expect(vi.mocked(confirmDialog).mock.calls[0][0]).toContain('Capacitación');
    expect(vi.mocked(confirmDialog).mock.calls[0][0]).toContain('Laura');
    await waitFor(() => expect(crearTurno).toHaveBeenCalled());
  });

  it('si la duena no confirma el aviso de bloqueo, no agenda', async () => {
    montar();
    useBloqueosAgendaStore.setState({
      bloqueos: [{ id: 1, user_id: 1, profesional_id: 1, fecha: '2099-06-10', hora_desde: null, hora_hasta: null, motivo: null, created_at: '', updated_at: '' }],
    });
    vi.mocked(confirmDialog).mockResolvedValueOnce(false);
    await elegirClienteYServicio(/^Combo pies y manos/);
    await screen.findByText('Softgel · con Ana');
    confirmar();

    await waitFor(() => expect(confirmDialog).toHaveBeenCalled());
    expect(crearTurno).not.toHaveBeenCalled();
  });

  it('con un problema de configuracion lo muestra y no deja agendar', async () => {
    montar(detalle({ problemas: [{ codigo: 'profesional_inactiva', orden: 2, profesional_id: 2, servicio_id: 3, mensaje: 'Laura está inactiva.' }] }));
    await elegirClienteYServicio(/^Combo pies y manos/);

    expect(await screen.findByText('Laura está inactiva.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Turno' })).toBeDisabled();
  });

  it('un horario que una clienta esta reservando se explica sin tecnicismos', async () => {
    crearTurno.mockResolvedValue({ success: false, code: 'slot_held', message: 'Una clienta está reservando ese horario' });
    montar();
    await elegirClienteYServicio(/^Combo pies y manos/);
    await screen.findByText('Softgel · con Ana');
    confirmar();

    await waitFor(() => expect(alertDialog).toHaveBeenCalled());
    const texto = vi.mocked(alertDialog).mock.calls[0][0];
    expect(texto).toMatch(/reservando/);
    expect(texto).not.toMatch(/clienta/);
  });

  it('no se puede combinar el combo con otros servicios en el mismo turno', async () => {
    montar();
    await elegirClienteYServicio(/^Combo pies y manos/);
    fireEvent.click(await screen.findByRole('button', { name: /^Manicura/ }));

    expect(await screen.findByText('El combo se agenda solo, sin otros servicios.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Turno' })).toBeDisabled();
  });
});
