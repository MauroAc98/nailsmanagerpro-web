import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/render';
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
    // Recorrido real: horario retenido, datos guardados y pago iniciado (mock-1).
    await flujoHasta('resumen', svc);
    await svc.iniciarPago('demo', useReservaOnlineStore.getState().hold!.reservaId);
  });
  afterEach(() => setServiceParaTests(null));

  const montar = (ir = vi.fn()) => {
    renderWithProviders(<EstadoReservaScreen slug="demo" id="mock-1" ir={ir} ahora={ahora} cadaMs={20} />);
    return ir;
  };

  describe('esperando el pago', () => {
    it('titulo, explicacion y resumen corto con la sena (sin total)', async () => {
      montar();
      expect(await screen.findByRole('heading', { name: 'Esperando tu pago' })).toBeInTheDocument();
      expect(
        screen.getByText('Completá el pago en Mercado Pago. Guardamos tu horario hasta que se acabe el tiempo.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Viernes 25 · 13:00')).toBeInTheDocument();
      expect(screen.getByText('Seña $5.000')).toBeInTheDocument();
    });

    it('anillo circular con la cuenta regresiva mm:ss de la ventana de pago (15:00)', async () => {
      montar();
      const anillo = await screen.findByRole('timer');
      expect(anillo).toHaveTextContent('15:00');
      expect(anillo.querySelector('svg circle[data-progreso]')).not.toBeNull();
      reloj = AHORA + 5 * MIN;
      await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('10:00'));
    });

    it('el anillo se vacia a medida que corre el tiempo', async () => {
      montar();
      const inicio = (await screen.findByRole('timer')).querySelector('circle[data-progreso]');
      expect(inicio).toHaveAttribute('data-progreso', '1');
      reloj = AHORA + 7.5 * MIN;
      await waitFor(() =>
        expect(screen.getByRole('timer').querySelector('circle[data-progreso]')).toHaveAttribute('data-progreso', '0.5'),
      );
    });

    it('"Volver a Mercado Pago" es el boton primario y apunta al checkout de la reserva', async () => {
      montar();
      const enlace = await screen.findByRole('link', { name: 'Volver a Mercado Pago' });
      expect(enlace).toHaveAttribute('href', expect.stringContaining('/reservar/demo/reserva/mock-1'));
    });

    it('"Ya pagué · actualizar estado" vuelve a pedir el estado y pasa a confirmado si ya se acredito', async () => {
      montar();
      await screen.findByRole('heading', { name: 'Esperando tu pago' });
      await svc.simulatePayment('mock-1'); // el pago entra por fuera de la pantalla
      await userEvent.click(screen.getByRole('button', { name: 'Ya pagué · actualizar estado' }));
      expect(await screen.findByRole('heading', { name: '¡Turno confirmado!' })).toBeInTheDocument();
    });

    it('la afordancia de desarrollo esta marcada "Solo desarrollo" y simula el pago', async () => {
      montar();
      expect(await screen.findByText('Solo desarrollo')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Simular pago aprobado' }));
      expect(await screen.findByRole('heading', { name: '¡Turno confirmado!' })).toBeInTheDocument();
    });
  });

  describe('turno confirmado (ticket)', () => {
    beforeEach(async () => {
      await svc.simulatePayment('mock-1');
    });

    it('titulo y detalle', async () => {
      montar();
      expect(await screen.findByRole('heading', { name: '¡Turno confirmado!' })).toBeInTheDocument();
      expect(screen.getByText('Te esperamos en Studio Demo. Te enviamos los detalles por WhatsApp.')).toBeInTheDocument();
    });

    it('cabecera del ticket: fecha, hora grande, duracion y profesional', async () => {
      montar();
      const ticket = (await screen.findByText('Viernes 25 de septiembre')).closest('[data-ticket]') as HTMLElement;
      expect(ticket).not.toBeNull();
      expect(within(ticket).getByText('13:00')).toBeInTheDocument();
      expect(within(ticket).getByText(/1 h 15 min/)).toBeInTheDocument();
      expect(within(ticket).getByText(/con Ana/)).toBeInTheDocument();
    });

    it('cuerpo: servicios, salon con direccion, sena pagada y nota del valor final', async () => {
      montar();
      const ticket = (await screen.findByText('Viernes 25 de septiembre')).closest('[data-ticket]') as HTMLElement;
      expect(within(ticket).getByText('Esmaltado semipermanente + Retiro de esmalte')).toBeInTheDocument();
      expect(within(ticket).getByText('Studio Demo · Av. Siempreviva 742')).toBeInTheDocument();
      expect(within(ticket).getByText('Seña pagada')).toBeInTheDocument();
      expect(within(ticket).getByText('$5.000')).toBeInTheDocument();
      expect(within(ticket).getByText('El valor final se confirma en el salón según tu diseño.')).toBeInTheDocument();
    });

    it('no muestra total ni "resta abonar"', async () => {
      montar();
      await screen.findByRole('heading', { name: '¡Turno confirmado!' });
      expect(screen.queryByText(/Resta abonar/)).toBeNull();
      expect(screen.queryByText('Total')).toBeNull();
      expect(screen.queryByText(/20\.000/)).toBeNull();
    });

    it('acciones: Agendar (Google Calendar) y Cómo llegar (Maps); sin WhatsApp del salon porque el DTO no lo trae', async () => {
      montar();
      expect(await screen.findByRole('link', { name: 'Agendar' })).toHaveAttribute(
        'href',
        expect.stringContaining('calendar.google.com'),
      );
      expect(screen.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute('href', expect.stringContaining('maps'));
      expect(screen.queryByRole('link', { name: /Salón|WhatsApp/ })).toBeNull();
    });

    it('explica como reprogramar o cancelar por el link de WhatsApp (gratis hasta 24 h antes)', async () => {
      montar();
      expect(await screen.findByText(/Gratis hasta 24 h antes/)).toBeInTheDocument();
      expect(screen.getByText(/link que te mandamos por WhatsApp/)).toBeInTheDocument();
    });

    it('limpia el flujo guardado', async () => {
      montar();
      await screen.findByRole('heading', { name: '¡Turno confirmado!' });
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
      expect(useReservaOnlineStore.getState().hold).toBeNull();
    });
  });

  describe('tiempo vencido', () => {
    it('pasados 15 min sin pagar: icono ambar, mensaje y nada de reintento de pago', async () => {
      montar();
      await screen.findByRole('heading', { name: 'Esperando tu pago' });
      reloj = AHORA + 15 * MIN;
      expect(await screen.findByRole('heading', { name: 'Se terminó el tiempo' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'No recibimos la seña y liberamos el horario de las 13:00. Si ya pagaste, escribinos y lo resolvemos.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Volver a Mercado Pago' })).toBeNull();
    });

    it('"Elegir otro horario" vuelve al horario conservando la seleccion, "Volver al inicio" a la entrada', async () => {
      reloj = AHORA + 20 * MIN;
      const ir = montar();
      await userEvent.click(await screen.findByRole('button', { name: 'Elegir otro horario' }));
      expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
      expect(useReservaOnlineStore.getState().hora).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
      expect(ir).toHaveBeenCalledWith('/reservar/demo');
    });
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
