import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for "Editar turno": the whole-combo reschedule lives in this
// same screen. Stores are the real zustand ones; the fetchers and the two
// write actions are replaced so the page boots from the state set here.
vi.mock('next/navigation', async () => ({
  ...(await import('@/test/mocks/nextNavigation')).nextNavigationMock,
  useParams: () => ({ id: '1' }),
}));
vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/store/useConfirmStore', () => ({
  alertDialog: vi.fn().mockResolvedValue(undefined),
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import type { Cliente } from '@/services/clienteService';
import type { Turno } from '@/services/turnoService';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';
import EditarTurnoPage from '@/app/(app)/agenda/[id]/page';

const servicio = (id: number, nombre: string): Servicio =>
  ({ id, user_id: 1, nombre, duracion_minutos: 30, precio: '5000', activo: true, es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '' });
const softgel = servicio(2, 'Softgel');
const semis = servicio(3, 'Semis pies');
const profesional = (id: number, nombre: string, servicios: Servicio[]): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo: true, dias_atencion: null, servicios } as unknown as Profesional);
const ana = profesional(1, 'Ana', [softgel]);
const laura = profesional(2, 'Laura', [semis]);
const marta: Cliente = { id: 5, nombre: 'Marta', apellido: 'Rios', telefono: '+543765252395', activo: true };

const tramo = (turno_id: number, profesional_id: number, nombre: string, hora: string, dur: number, estado = 'confirmado') =>
  ({ turno_id, profesional_id, profesional_nombre: nombre, fecha_hora: `2099-06-10T${hora}:00`, duracion_total_minutos: dur, estado });
const turno = (over: Partial<Turno> = {}): Turno => ({
  id: 1, cliente_id: 5, cliente: { nombre: 'Marta', apellido: 'Rios' }, servicios: [{ id: 2, nombre: 'Softgel' }],
  fecha_hora: '2099-06-10 10:00:00', duracion_total_minutos: 60, estado: 'confirmado', estado_visual: 'confirmado',
  profesional_id: 1, grupo_id: null, ...over,
} as Turno);
const enGrupo = (tramos = [tramo(1, 1, 'Ana', '10:00', 60), tramo(2, 2, 'Laura', '11:00', 45)]) =>
  turno({ grupo_id: 7, grupo: { id: 7, modo: 'secuencia', tramos: tramos as never } });

const actualizarTurno = vi.fn();
const reprogramarGrupo = vi.fn();
const fetchTurno = vi.fn();

function montar(t: Turno) {
  useServiciosStore.setState({ servicios: [softgel, semis], fetchServicios: vi.fn() });
  useProfesionalStore.setState({ profesionales: [ana, laura], fetchProfesionales: vi.fn() });
  useClientesStore.setState({ clientes: [marta], fetchClientes: vi.fn() });
  useSlotsStore.setState({
    slots: [{ id: 1, hora: '09:00', activo: true }, { id: 2, hora: '18:00', activo: true }] as never,
    fetchSlots: vi.fn(), loading: false, ultimoProfesionalIdSolicitado: 1,
  });
  useBloqueosAgendaStore.setState({ bloqueos: [], fetchBloqueos: vi.fn() });
  useTurnoStore.setState({ turnoActual: t, loadingTurno: false, errorTurno: null, turnos: [], fetchTurnos: vi.fn(), fetchTurno, actualizarTurno, reprogramarGrupo });
  return renderWithProviders(<EditarTurnoPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  actualizarTurno.mockResolvedValue({ success: true });
  reprogramarGrupo.mockResolvedValue({ success: true, notificacion: 'enviada' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2099-06-01T10:00:00'));
});
afterEach(() => vi.useRealTimers());

const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
const moverCombo = () => fireEvent.click(screen.getByRole('button', { name: 'Mover todo el grupo' }));
const elegirCombo = async () => fireEvent.click(await screen.findByRole('button', { name: 'Todo el grupo' }));

describe('EditarTurnoPage — turno comun (Rule L)', () => {
  it('no ofrece mover un combo y guarda exactamente como siempre', async () => {
    montar(turno());
    await screen.findByText('Marta Rios');
    expect(screen.queryByRole('button', { name: 'Todo el grupo' })).not.toBeInTheDocument();
    guardar();

    await waitFor(() => expect(actualizarTurno).toHaveBeenCalledWith(1, {
      cliente_id: 5, servicio_ids: [2], fecha_hora: '2099-06-10 10:00', profesional_id: 1,
    }));
    expect(reprogramarGrupo).not.toHaveBeenCalled();
  });

  it('un turno de un combo con "Solo este turno" se guarda por separado, igual que antes', async () => {
    montar(enGrupo());
    await screen.findByRole('button', { name: 'Solo este turno' });
    guardar();

    await waitFor(() => expect(actualizarTurno).toHaveBeenCalledWith(1, expect.objectContaining({ servicio_ids: [2], fecha_hora: '2099-06-10 10:00' })));
    expect(reprogramarGrupo).not.toHaveBeenCalled();
  });
});

describe('EditarTurnoPage — fecha de un turno suelto', () => {
  it('permite mover el turno a otro dia y lo manda al guardar', async () => {
    montar(turno());
    await screen.findByText('Marta Rios');
    fireEvent.change(screen.getByLabelText('FECHA DEL TURNO'), { target: { value: '2099-06-12' } });
    guardar();

    await waitFor(() => expect(actualizarTurno).toHaveBeenCalledWith(1, expect.objectContaining({ fecha_hora: '2099-06-12 10:00' })));
  });
});

describe('EditarTurnoPage — selector de cliente', () => {
  const otraMarta: Cliente = { id: 6, nombre: 'Marta', apellido: 'Rios', telefono: '+543764000111', activo: true };
  const abrirSelector = async () => {
    // El campo muestra el cliente elegido; tocarlo abre la lista.
    fireEvent.click((await screen.findAllByText('Marta Rios'))[0]);
  };

  it('el campo muestra el teléfono del cliente elegido', async () => {
    montar(turno());

    expect(await screen.findByText('+543765252395')).toBeInTheDocument();
  });

  it('con dos clientes del mismo nombre, la lista muestra el teléfono de cada uno', async () => {
    montar(turno());
    useClientesStore.setState({ clientes: [marta, otraMarta] });
    await abrirSelector();

    expect((await screen.findAllByText('+543764000111')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+543765252395').length).toBeGreaterThanOrEqual(2); // campo + fila
  });

  it('se puede buscar por teléfono', async () => {
    montar(turno());
    useClientesStore.setState({ clientes: [marta, otraMarta] });
    await abrirSelector();
    fireEvent.change(await screen.findByPlaceholderText('Buscar por nombre...'), { target: { value: '4000111' } });

    await waitFor(() => expect(screen.queryAllByText('+543765252395')).toHaveLength(1)); // solo el campo
    expect(screen.getAllByText('+543764000111').length).toBeGreaterThanOrEqual(1);
  });
});

describe('EditarTurnoPage — panel de pago', () => {
  it('no se muestra en un turno confirmado sin seña, aunque tenga precio de lista', async () => {
    montar(turno({ sena: null }));
    await screen.findByText('Marta Rios');

    expect(screen.queryByText('Falta cobrar')).not.toBeInTheDocument();
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
  });

  it('se muestra cuando hay una seña online pagada', async () => {
    montar(turno({ sena: { monto: 2000, estado: 'aprobado', reserva_web_id: 9 } }));
    await screen.findByText('Marta Rios');

    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('Seña pagada')).toBeInTheDocument();
    expect(screen.getByText('Falta cobrar')).toBeInTheDocument();
  });

  it('no se muestra con una seña pendiente de pago', async () => {
    montar(turno({ sena: { monto: 2000, estado: 'pendiente', reserva_web_id: 9 } }));
    await screen.findByText('Marta Rios');

    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
  });
});

describe('EditarTurnoPage — mover todo el combo', () => {
  it('lista lo que se mueve (sin los ya atendidos ni cancelados) y ocultar jerga', async () => {
    montar(enGrupo([tramo(1, 1, 'Ana', '10:00', 60), tramo(2, 2, 'Laura', '11:00', 45), tramo(3, 1, 'Ana', '12:00', 30, 'completado'), tramo(4, 2, 'Laura', '13:00', 30, 'cancelado')]));
    await elegirCombo();

    expect(screen.getByText('10:00 · con Ana')).toBeInTheDocument();
    expect(screen.getByText('11:00 · con Laura')).toBeInTheDocument();
    expect(screen.queryByText('12:00 · con Ana')).not.toBeInTheDocument();
    expect(screen.queryByText('13:00 · con Laura')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia/i);
  });

  it('manda la nueva fecha y hora del primer turno al endpoint del grupo y avisa que se movio', async () => {
    montar(enGrupo());
    await elegirCombo();
    fireEvent.change(screen.getByLabelText('Nueva fecha del grupo'), { target: { value: '2099-06-12' } });
    moverCombo();

    await waitFor(() => expect(reprogramarGrupo).toHaveBeenCalledWith(7, '2099-06-12 10:00'));
    expect(actualizarTurno).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.back).toHaveBeenCalled());
    expect(alertDialog).not.toHaveBeenCalled();
  });

  it('si no se pudo avisar al cliente, lo dice claramente', async () => {
    reprogramarGrupo.mockResolvedValue({ success: true, notificacion: 'omitida', motivo: 'opt_out' });
    montar(enGrupo());
    await elegirCombo();
    moverCombo();

    await waitFor(() => expect(alertDialog).toHaveBeenCalledWith('No se avisó al cliente, avisale vos.'));
  });

  it('avisa del bloqueo de cada profesional antes de mover, y si no se confirma no mueve', async () => {
    montar(enGrupo());
    useBloqueosAgendaStore.setState({
      bloqueos: [{ id: 1, user_id: 1, profesional_id: 2, fecha: '2099-06-10', hora_desde: '11:00', hora_hasta: '12:00', motivo: 'Capacitación', created_at: '', updated_at: '' }],
    });
    vi.mocked(confirmDialog).mockResolvedValueOnce(false);
    await elegirCombo();
    moverCombo();

    await waitFor(() => expect(confirmDialog).toHaveBeenCalledTimes(1));
    expect(vi.mocked(confirmDialog).mock.calls[0][0]).toContain('Capacitación');
    expect(reprogramarGrupo).not.toHaveBeenCalled();
  });

  it('un combo con un turno ya atendido se explica y se refresca', async () => {
    reprogramarGrupo.mockResolvedValue({ success: false, code: 'grupo_en_curso', message: 'x' });
    montar(enGrupo());
    await elegirCombo();
    moverCombo();

    await waitFor(() => expect(alertDialog).toHaveBeenCalledWith('Este grupo de servicios ya tiene un turno atendido; no se puede mover completo.'));
    expect(fetchTurno).toHaveBeenCalledTimes(2); // al abrir + al refrescar
  });

  it('un horario que alguien esta reservando se explica sin tecnicismos', async () => {
    reprogramarGrupo.mockResolvedValue({ success: false, code: 'slot_held', message: 'Una clienta está reservando' });
    montar(enGrupo());
    await elegirCombo();
    moverCombo();

    await waitFor(() => expect(alertDialog).toHaveBeenCalled());
    const texto = vi.mocked(alertDialog).mock.calls[0][0];
    expect(texto).toMatch(/reservando/);
    expect(texto).not.toMatch(/clienta/);
  });
});
