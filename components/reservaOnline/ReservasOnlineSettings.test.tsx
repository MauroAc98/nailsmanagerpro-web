import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { ReservasOnlineSettings } from './ReservasOnlineSettings';
import { prepararServicio } from './testUtils';

describe('ReservasOnlineSettings', () => {
  let svc: MockReservaOnlineService;
  beforeEach(() => {
    svc = prepararServicio();
  });
  afterEach(() => setServiceParaTests(null));

  const montar = () => renderWithProviders(<ReservasOnlineSettings slug="nails-by-natalie" />);
  const interruptor = () => screen.findByRole('switch', { name: 'Aceptar reservas online' });

  it('arranca inactivo y con el link bloqueado', async () => {
    montar();
    expect(await interruptor()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText(/El link se habilita cuando activás/)).toBeInTheDocument();
  });

  it('no se puede activar sin Mercado Pago conectado', async () => {
    montar();
    await userEvent.click(await interruptor());
    expect(screen.getByText('Conectá Mercado Pago para poder activarlas.')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect((await svc.getSettings()).habilitada).toBe(false);
  });

  it('conectar Mercado Pago y activar persiste y habilita el link', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Conectar Mercado Pago' }));
    expect(await screen.findByText('Conectada · cuenta-demo@turnetto.com')).toBeInTheDocument();
    await userEvent.click(await interruptor());
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    expect((await svc.getSettings()).habilitada).toBe(true);
    expect(screen.getByText('http://localhost:3000/reservar/nails-by-natalie')).toBeInTheDocument();
  });

  it('Enviar abre WhatsApp con el link en el mensaje', async () => {
    await svc.connectMp();
    await svc.saveSettings({ habilitada: true });
    montar();
    const enviar = await screen.findByRole('link', { name: 'Enviar' });
    const href = new URL(enviar.getAttribute('href') as string);
    expect(href.origin).toBe('https://wa.me');
    expect(href.searchParams.get('text')).toBe(
      'Reservá tu turno online acá: http://localhost:3000/reservar/nails-by-natalie',
    );
  });

  it('Copiar escribe el link en el portapapeles y confirma', async () => {
    await svc.connectMp();
    await svc.saveSettings({ habilitada: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/reservar/nails-by-natalie');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('desconectar Mercado Pago vuelve a bloquear el link', async () => {
    await svc.connectMp();
    await svc.saveSettings({ habilitada: true });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    expect(await screen.findByText(/El link se habilita cuando activás/)).toBeInTheDocument();
  });

  it('editar la sena, el tiempo de pago y las ventanas persiste en el mock', async () => {
    montar();
    const sena = await screen.findByLabelText('Seña');
    await userEvent.clear(sena);
    await userEvent.type(sena, '7000');
    await userEvent.tab();
    const pago = screen.getByLabelText('Tiempo para pagar');
    await userEvent.clear(pago);
    await userEvent.type(pago, '20');
    await userEvent.tab();
    const antelacion = screen.getByLabelText('Reservar con antelación');
    await userEvent.clear(antelacion);
    await userEvent.type(antelacion, '3');
    await userEvent.tab();
    const cancelacion = screen.getByLabelText('Cancelación gratis hasta');
    await userEvent.clear(cancelacion);
    await userEvent.type(cancelacion, '48');
    await userEvent.tab();
    await waitFor(async () => {
      const s = await svc.getSettings();
      expect(s).toMatchObject({
        deposito: 7000,
        ventanaPagoMinutos: 20,
        anticipacionMinutos: 180,
        ventanaCancelacionHoras: 48,
      });
    });
  });

  it('un valor invalido (vacio o 0) no se guarda', async () => {
    montar();
    const sena = await screen.findByLabelText('Seña');
    await userEvent.clear(sena);
    await userEvent.tab();
    expect((await svc.getSettings()).deposito).toBe(5000);
  });
});
