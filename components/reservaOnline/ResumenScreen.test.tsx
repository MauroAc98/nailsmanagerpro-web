import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { ResumenScreen } from './ResumenScreen';
import { AHORA, flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

const MIN = 60_000;

describe('ResumenScreen', () => {
  let reloj = AHORA;
  let svc: MockReservaOnlineService;
  beforeEach(async () => {
    reloj = AHORA;
    svc = prepararServicio(() => reloj);
    limpiarFlujo();
    await flujoHasta('resumen', svc);
  });
  afterEach(() => setServiceParaTests(null));

  it('con datos personales incompletos redirige a datos (guard)', async () => {
    useReservaOnlineStore.getState().setCliente({ whatsapp: '1155' });
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/datos'));
  });

  it('muestra fecha, hora, duracion, servicios (sin precios), profesional y direccion del salon', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Revisá y confirmá' })).toBeInTheDocument();
    expect(await screen.findByText('Viernes 25 de septiembre · 13:00')).toBeInTheDocument();
    expect(screen.getByText('Duración 1 h 15 min')).toBeInTheDocument();
    expect(screen.getByText('Esmaltado semipermanente + Retiro de esmalte')).toBeInTheDocument();
    expect(screen.getByText('Con Ana')).toBeInTheDocument();
    expect(screen.getByText('Studio Demo')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
  });

  it('NO hay total ni precios por servicio: el unico monto es la sena', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    await screen.findByText('Seña para reservar');
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText(/12\.000/)).toBeNull();
    expect(screen.queryByText(/20\.000/)).toBeNull();
    expect(screen.getByText('$5.000')).toBeInTheDocument();
  });

  it('la sena aclara que es parte del valor final y el resto se define y paga en el salon', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(
      await screen.findByText('Es parte del valor final. El resto se define en el salón según tu diseño y se abona ahí.'),
    ).toBeInTheDocument();
  });

  it('avisa el tiempo para pagar y la cancelacion gratis (24 h por defecto)', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Tenés 15 minutos para pagar y asegurar el horario')).toBeInTheDocument();
    expect(screen.getByText('Cancelación gratis hasta 24 h antes')).toBeInTheDocument();
  });

  it('muestra "Tu idea" solo si la clienta la escribio', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    await screen.findByText('Seña para reservar');
    expect(screen.queryByText('Tu idea')).toBeNull();
  });

  it('con idea guardada la muestra en el resumen', async () => {
    useReservaOnlineStore.getState().setNota('flores y dorado');
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Tu idea')).toBeInTheDocument();
    expect(screen.getByText('flores y dorado')).toBeInTheDocument();
  });

  it('con "Cualquiera" muestra la profesional que el backend asigno al retener', async () => {
    const s = useReservaOnlineStore.getState();
    s.setProfesional('any');
    s.setHorario('2026-09-25', '13:00');
    s.setHold({ reservaId: s.hold!.reservaId, expiraMs: s.hold!.expiraMs, profesionalId: 2 });
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Con Lucía')).toBeInTheDocument();
  });

  it('la barra superior muestra la cuenta regresiva del hold', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} ahora={() => AHORA + 5 * MIN} cadaMs={20} />);
    expect(await screen.findByText('Tu horario está reservado · 05:00')).toBeInTheDocument();
  });

  it('"Pagar seña" inicia el pago (extiende a 15 min) y navega a la pagina de estado', async () => {
    const ir = vi.fn();
    reloj = AHORA + 4 * MIN;
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} ahora={() => AHORA + 4 * MIN} />);
    await userEvent.click(await screen.findByRole('button', { name: /Pagar seña con/ }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/reserva/mock-1'));
    const est = await svc.getReservationStatus('demo', 'mock-1');
    expect(est.status).toBe('pending_payment');
    expect(est.expiresAtMs).toBe(AHORA + 19 * MIN);
    expect(est.summary.profesionalId).toBe(1);
  });

  it('si el hold vencio: "Se liberó tu horario" y NO se puede pagar', async () => {
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} ahora={() => AHORA + 10 * MIN} cadaMs={20} />);
    expect(await screen.findByRole('heading', { name: 'Se liberó tu horario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pagar seña con/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Elegir otro horario' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
    expect(useReservaOnlineStore.getState().hora).toBeNull();
  });

  it('si el servidor dice hold_expired al pagar, muestra el aviso y no navega al pago', async () => {
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} ahora={() => AHORA} cadaMs={20} />);
    const boton = await screen.findByRole('button', { name: /Pagar seña con/ });
    reloj = AHORA + 11 * MIN; // el reloj del servidor avanzo, el de la pantalla no
    await userEvent.click(boton);
    expect(await screen.findByRole('heading', { name: 'Se liberó tu horario' })).toBeInTheDocument();
    expect(ir).not.toHaveBeenCalledWith(expect.stringContaining('/reserva/'));
  });
});
