import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for "Nuevo turno" cargando VARIOS turnos para el mismo cliente.
// Boundary = services/stores mockeados, igual que NuevoTurnoPromo.test.tsx.
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

import { alertDialog } from '@/store/useConfirmStore';
import { whatsappHelper } from '@/lib/whatsappHelper';
import { servicioService, type Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import type { Cliente } from '@/services/clienteService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useAuthStore } from '@/store/useAuthStore';
import { resetNavigationMock, routerMock, setMockLocation } from '@/test/mocks/nextNavigation';
import NuevoTurnoPage from '@/app/(app)/agenda/nuevo/page';

const servicio = (over: Partial<Servicio>): Servicio => ({
  id: 1, user_id: 1, nombre: 'Manicura', duracion_minutos: 30, precio: '5000', activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '', ...over,
});
const profesional = (id: number, nombre: string, servicios: Servicio[]): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo: true, dias_atencion: null, servicios } as unknown as Profesional);

const manicura = servicio({ id: 1 });
const softgel = servicio({ id: 2, nombre: 'Softgel', duracion_minutos: 60, precio: '13000' });
const combo = servicio({ id: 9, nombre: 'Combo pies y manos', es_promo: true, modo_promo: 'secuencia', duracion_minutos: 105, precio: '18000' });
const ana = profesional(1, 'Ana', [manicura, softgel]);
const marta: Cliente = { id: 5, nombre: 'Marta', apellido: 'Rios', telefono: '+543765252395', activo: true };

const crearTurno = vi.fn();
const crearLote = vi.fn();

function montar(search = 'fecha=2099-06-10') {
  setMockLocation('/agenda/nuevo', search);
  vi.mocked(servicioService.getOne).mockResolvedValue(combo);
  useServiciosStore.setState({ servicios: [manicura, softgel, combo], fetchServicios: vi.fn() });
  useProfesionalStore.setState({ profesionales: [ana], fetchProfesionales: vi.fn() });
  useClientesStore.setState({ clientes: [marta], fetchClientes: vi.fn() });
  useSlotsStore.setState({ slots: [{ id: 1, hora: '09:00', activo: true }, { id: 2, hora: '18:00', activo: true }] as never, fetchSlots: vi.fn(), loading: false, ultimoProfesionalIdSolicitado: null });
  useBloqueosAgendaStore.setState({ bloqueos: [], fetchBloqueos: vi.fn() });
  useTurnoStore.setState({ turnos: [], fetchTurnos: vi.fn(), crearTurno, crearLote });
  return renderWithProviders(<NuevoTurnoPage />);
}

const elegirCliente = async () => {
  fireEvent.click(await screen.findByText('Seleccionar...'));
  fireEvent.click(await screen.findByText('Marta Rios'));
};
const elegirServicio = async (nombre: RegExp) => fireEvent.click(await screen.findByRole('button', { name: nombre }));
const confirmar = (nombre = 'Confirmar Turno') => fireEvent.click(screen.getByRole('button', { name: nombre }));
const agregar = () => fireEvent.click(screen.getByRole('button', { name: 'Agregar otro turno' }));
const agregarSegundo = async () => {
  await elegirCliente();
  await elegirServicio(/^Manicura/);
  agregar();
  await screen.findByText('Turno 2');
};

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  crearTurno.mockResolvedValue({ success: true });
  crearLote.mockResolvedValue({ success: true });
  useAuthStore.setState({ user: null });
  useTurnoStore.setState({ fechaDeRetorno: null });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2099-06-01T10:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('NuevoTurnoPage — un solo turno (igual que siempre)', () => {
  it('sin fila Día, con "Confirmar Turno" y el mismo crearTurno de siempre', async () => {
    montar();
    await elegirCliente();
    await elegirServicio(/^Manicura/);

    expect(screen.queryByText('DÍA')).not.toBeInTheDocument();
    expect(screen.getByText(/DÍA SELECCIONADO/)).toBeInTheDocument();
    confirmar();

    await waitFor(() => expect(crearTurno).toHaveBeenCalledWith({ cliente_id: 5, servicio_ids: [1], fecha_hora: '2099-06-10 10:00' }));
    expect(crearLote).not.toHaveBeenCalled();
    expect(routerMock.back).toHaveBeenCalled();
    // La agenda reabre en el día del turno creado, no en hoy.
    expect(useTurnoStore.getState().fechaDeRetorno).toBe('2099-06-10');
  });

  it('el botón "Agregar otro turno" no aparece hasta elegir cliente', async () => {
    montar();
    await screen.findByText('Seleccionar...');
    expect(screen.queryByRole('button', { name: 'Agregar otro turno' })).not.toBeInTheDocument();
    await elegirCliente();
    expect(screen.getByRole('button', { name: 'Agregar otro turno' })).toBeInTheDocument();
  });

  it('con una promo-combo elegida el botón desaparece', async () => {
    montar();
    await elegirCliente();
    await elegirServicio(/^Combo pies y manos/);
    expect(screen.queryByRole('button', { name: 'Agregar otro turno' })).not.toBeInTheDocument();
  });
});

describe('NuevoTurnoPage — varios turnos', () => {
  it('agregar pliega el actual, abre el Turno 2 con la fila Día y cambia el botón', async () => {
    montar();
    await agregarSegundo();

    // Turno 1 plegado: círculo, "{día} · {hora}" y servicios.
    const resumen = screen.getByRole('button', { name: /^Editar turno 1:/ });
    expect(resumen).toHaveTextContent(/10 jun · 10:00 a\. m\./);
    expect(resumen).toHaveTextContent('Manicura');
    // Turno 2 abierto, vacío, con su fila Día.
    expect(screen.getByText('DÍA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^DÍA: .*10 de junio/i })).toBeInTheDocument();
    expect(screen.queryByText(/DÍA SELECCIONADO/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar 2 turnos' })).toBeDisabled();
  });

  it('un turno inválido no se agrega: avisa y queda en el mismo bloque', async () => {
    montar('fecha=2000-01-01'); // pasado: validarTurno lo rechaza
    await elegirCliente();
    await elegirServicio(/^Manicura/);
    agregar();

    await waitFor(() => expect(alertDialog).toHaveBeenCalled());
    expect(screen.queryByText('Turno 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Turno' })).toBeInTheDocument();
  });

  it('quitar el turno 2 vuelve al modo simple conservando los datos', async () => {
    montar();
    await agregarSegundo();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar turno 2' }));

    expect(screen.queryByText('Turno 2')).not.toBeInTheDocument();
    expect(screen.queryByText('DÍA')).not.toBeInTheDocument();
    expect(screen.getByText(/DÍA SELECCIONADO/)).toBeInTheDocument();
    confirmar();
    await waitFor(() => expect(crearTurno).toHaveBeenCalledWith({ cliente_id: 5, servicio_ids: [1], fecha_hora: '2099-06-10 10:00' }));
    expect(crearLote).not.toHaveBeenCalled();
  });

  it('confirmar N turnos llama a crearLote con el payload de cada bloque', async () => {
    montar();
    await agregarSegundo();
    await elegirServicio(/^Softgel/);
    // Otro día para el turno 2, desde la hoja "Elegir fecha".
    fireEvent.click(screen.getByRole('button', { name: /^DÍA:/ }));
    fireEvent.click(await screen.findByTestId('cal-day-2099-06-12'));
    expect(screen.getByRole('button', { name: /^DÍA: .*12 de junio/i })).toBeInTheDocument();

    confirmar('Confirmar 2 turnos');
    await waitFor(() => expect(crearLote).toHaveBeenCalledWith({
      cliente_id: 5,
      turnos: [
        { fecha_hora: '2099-06-10 10:00', servicio_ids: [1] },
        { fecha_hora: '2099-06-12 10:00', servicio_ids: [2] },
      ],
    }));
    expect(crearTurno).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.back).toHaveBeenCalled());
    // Con fechas distintas vuelve a la más temprana.
    expect(useTurnoStore.getState().fechaDeRetorno).toBe('2099-06-10');
  });

  it('un 422 con índice muestra el mensaje y abre ese turno', async () => {
    crearLote.mockResolvedValue({ success: false, message: 'Turno 1: Ya hay un turno en ese horario.', indice: 0 });
    montar();
    await agregarSegundo();
    await elegirServicio(/^Softgel/);
    confirmar('Confirmar 2 turnos');

    await waitFor(() => expect(alertDialog).toHaveBeenCalledWith('Turno 1: Ya hay un turno en ese horario.'));
    // El turno 1 quedó abierto y el 2 plegado.
    expect(screen.getByText('Turno 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Editar turno 2:/ })).toBeInTheDocument();
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(useTurnoStore.getState().fechaDeRetorno).toBeNull();
  });

  it('tocar un turno plegado lo reabre y pliega el que estaba abierto', async () => {
    montar();
    await agregarSegundo();
    await elegirServicio(/^Softgel/);
    fireEvent.click(screen.getByRole('button', { name: /^Editar turno 1:/ }));

    expect(await screen.findByText('Turno 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Editar turno 2:/ })).toHaveTextContent('Softgel');
  });

  it('con envío manual de WhatsApp lista cada turno creado con su propio link de WhatsApp', async () => {
    useAuthStore.setState({ user: { name: 'Salon Luna', whatsapp_requiere_envio_manual: true } as never });
    crearLote.mockResolvedValue({
      success: true,
      turnos: [
        { id: 1, fecha_hora: '2099-06-10 10:00:00', servicios: [{ id: 1, nombre: 'Manicura' }] },
        { id: 2, fecha_hora: '2099-06-12 10:00:00', servicios: [{ id: 2, nombre: 'Softgel' }] },
      ],
    });
    montar();
    await agregarSegundo();
    await elegirServicio(/^Softgel/);
    confirmar('Confirmar 2 turnos');

    expect(await screen.findByText('Turnos agendados')).toBeInTheDocument();
    const esperado = (fecha: string, servicio: string) => whatsappHelper.buildUrl({
      clienteNombre: 'Marta', clienteTelefono: '+543765252395', servicio, fecha, hora: '10:00',
      tipo: 'confirmacion', negocio: 'Salon Luna', direccion: null, telefonoNegocio: null,
    });
    const links = screen.getAllByRole('link', { name: /^Enviar confirmación por WhatsApp del turno/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', esperado('2099-06-10', 'Manicura'));
    expect(links[1]).toHaveAttribute('href', esperado('2099-06-12', 'Softgel'));
    expect(links[0].getAttribute('href')).toContain('wa.me/5493765252395');
    expect(links[0]).toHaveAccessibleName(/10 jun · 10:00 a\. m\./);
    expect(links[1]).toHaveAccessibleName(/12 jun · 10:00 a\. m\./);
    // No se vuelve solo: recién con "Listo".
    expect(routerMock.back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('con el envío manual apagado va por el toast y vuelve solo', async () => {
    useAuthStore.setState({ user: { whatsapp_requiere_envio_manual: false } as never });
    montar();
    await agregarSegundo();
    await elegirServicio(/^Softgel/);
    confirmar('Confirmar 2 turnos');

    await waitFor(() => expect(routerMock.back).toHaveBeenCalled());
    expect(screen.queryByText('Turnos agendados')).not.toBeInTheDocument();
  });

  it('el éxito de un turno simple con envío manual no cambia: un solo botón grande', async () => {
    useAuthStore.setState({ user: { name: 'Salon Luna', whatsapp_requiere_envio_manual: true } as never });
    montar();
    await elegirCliente();
    await elegirServicio(/^Manicura/);
    confirmar();

    expect(await screen.findByText('Turno agendado')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Enviar confirmación por WhatsApp' });
    expect(link).toHaveAttribute('href', whatsappHelper.buildUrl({
      clienteNombre: 'Marta', clienteTelefono: '+543765252395', servicio: 'Manicura', fecha: '2099-06-10',
      hora: '10:00', tipo: 'confirmacion', negocio: 'Salon Luna', direccion: null, telefonoNegocio: null,
    }));
    expect(routerMock.back).not.toHaveBeenCalled();
  });
});
