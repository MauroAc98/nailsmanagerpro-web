import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { ResumenScreen } from './ResumenScreen';
import { flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

describe('ResumenScreen', () => {
  let svc: MockReservaOnlineService;
  beforeEach(() => {
    svc = prepararServicio();
    limpiarFlujo();
    flujoHasta('resumen');
  });
  afterEach(() => setServiceParaTests(null));

  it('con datos personales incompletos redirige a datos (guard)', async () => {
    useReservaOnlineStore.getState().setCliente({ whatsapp: '1155' });
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/datos'));
  });

  it('muestra fecha, hora, profesional, detalle, total, sena y resto', async () => {
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Viernes 25 de septiembre')).toBeInTheDocument();
    expect(screen.getByText('13:00 · con Ana · 75 min')).toBeInTheDocument();
    expect(screen.getByText('Esmaltado semipermanente')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$20.000', { selector: 'span' })).toBeInTheDocument(); // total
    expect(screen.getByText('$5.000')).toBeInTheDocument(); // sena
    expect(screen.getByText(/El resto \(\$15\.000\) lo abonás en el salón/)).toBeInTheDocument();
    expect(screen.getByText(/Tenés 15 minutos/)).toBeInTheDocument();
  });

  it('con "Cualquiera" resuelve la profesional que tiene el horario libre', async () => {
    useReservaOnlineStore.getState().setProfesional('any');
    useReservaOnlineStore.getState().setHorario('2026-09-25', '13:00');
    renderWithProviders(<ResumenScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('13:00 · con Ana · 75 min')).toBeInTheDocument();
  });

  it('"Pagar con Mercado Pago" crea la reserva pendiente y navega a su pagina', async () => {
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} />);
    await userEvent.click(await screen.findByRole('button', { name: /Pagar seña con/ }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/reserva/mock-1'));
    expect(useReservaOnlineStore.getState().reservaId).toBe('mock-1');
    const est = await svc.getReservationStatus('demo', 'mock-1');
    expect(est.status).toBe('pending_payment');
    expect(est.summary.profesionalId).toBe(1);
  });

  it('un horario que ya no esta libre ofrece elegir otro y no permite pagar', async () => {
    await svc.createReservation('demo', {
      servicioIds: [1, 2],
      profesionalId: 1,
      fecha: '2026-09-25',
      hora: '13:00',
      cliente: { nombre: 'Otra', apellido: 'Clienta', whatsapp: '+5491155551234' },
    });
    const ir = vi.fn();
    renderWithProviders(<ResumenScreen slug="demo" ir={ir} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario se acaba de ocupar');
    expect(screen.queryByRole('button', { name: /Pagar seña con/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Elegir otro horario' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
  });
});
