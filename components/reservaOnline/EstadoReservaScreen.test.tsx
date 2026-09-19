import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { EstadoReservaScreen } from './EstadoReservaScreen';
import { AHORA, flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

const MIN = 60_000;

describe('EstadoReservaScreen', () => {
  let reloj = AHORA;
  let svc: MockReservaOnlineService;
  const ahora = () => reloj;

  beforeEach(async () => {
    reloj = AHORA;
    svc = prepararServicio(ahora);
    limpiarFlujo();
    flujoHasta('resumen');
    await svc.createReservation('demo', {
      servicioIds: [1, 2],
      profesionalId: 1,
      fecha: '2026-09-25',
      hora: '13:00',
      cliente: { nombre: 'Marta', apellido: 'Ríos', whatsapp: '+5493765123456' },
    });
    useReservaOnlineStore.getState().setReservaId('mock-1');
  });
  afterEach(() => setServiceParaTests(null));

  const montar = (ir = vi.fn()) => {
    renderWithProviders(<EstadoReservaScreen slug="demo" id="mock-1" ir={ir} ahora={ahora} cadaMs={20} />);
    return ir;
  };

  it('pendiente: muestra la cuenta regresiva de la ventana de pago (15:00)', async () => {
    montar();
    expect(await screen.findByText('Esperando el pago de la seña')).toBeInTheDocument();
    expect(screen.getByText(/Tenés 15:00 para completar el pago/)).toBeInTheDocument();
  });

  it('pendiente: la afordancia de desarrollo simula el pago y pasa a confirmado', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago aprobado' }));
    expect(await screen.findByRole('heading', { name: '¡Turno confirmado!' })).toBeInTheDocument();
    expect(screen.getByText('Te esperamos en Studio Demo. Te enviamos los detalles por WhatsApp.')).toBeInTheDocument();
    expect(screen.getByText('Viernes 25 de septiembre · 13:00')).toBeInTheDocument();
    expect(screen.getByText('Seña pagada')).toBeInTheDocument();
    expect(screen.getByText('$15.000')).toBeInTheDocument(); // resta abonar
    expect(screen.getByText(/hasta 24 h antes/)).toBeInTheDocument();
  });

  it('confirmado: limpia el flujo guardado', async () => {
    await svc.simulatePayment('mock-1');
    montar();
    await screen.findByRole('heading', { name: '¡Turno confirmado!' });
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
    expect(useReservaOnlineStore.getState().reservaId).toBeNull();
  });

  it('confirmado: Agendar y Como llegar son links', async () => {
    await svc.simulatePayment('mock-1');
    montar();
    expect(await screen.findByRole('link', { name: 'Agendar' })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    );
    expect(screen.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute(
      'href',
      expect.stringContaining('maps'),
    );
  });

  it('vencida: pasados 15 min sin pagar pasa a "Se venció el tiempo de pago"', async () => {
    montar();
    await screen.findByText('Esperando el pago de la seña');
    reloj = AHORA + 15 * MIN;
    expect(await screen.findByRole('heading', { name: 'Se venció el tiempo de pago' })).toBeInTheDocument();
    expect(screen.getByText(/Liberamos el horario de las 13:00/)).toBeInTheDocument();
  });

  it('vencida: "Elegir otro horario" vuelve al horario conservando la seleccion, "Volver al inicio" a la entrada', async () => {
    reloj = AHORA + 20 * MIN;
    const ir = montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Elegir otro horario' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
    expect(useReservaOnlineStore.getState().hora).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo');
  });

  it('reserva inexistente: mensaje de no encontrada', async () => {
    renderWithProviders(<EstadoReservaScreen slug="demo" id="nada" ir={() => {}} ahora={ahora} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No encontramos esta reserva.'));
  });

  it('cancelada: lo informa', async () => {
    await svc.cancelReservation('demo', 'mock-1');
    montar();
    expect(await screen.findByText('Esta reserva fue cancelada')).toBeInTheDocument();
  });
});
