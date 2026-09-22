import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { ReservasOnlineSettings } from './ReservasOnlineSettings';
import { prepararServicio } from './testUtils';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// La tarjeta de Mercado Pago (OAuth) y la de ajustes numericos (sena, ventana
// de pago, antelacion, cancelacion) se sacaron de esta pantalla: eran mock
// puro, nunca conectado a nada real, y el monto de "seña" que se editaba ahi
// era un campo separado del sena_monto real de Perfil — confundia al negocio,
// que cambiaba un numero que despues no se usaba para cobrar nada.
describe('ReservasOnlineSettings', () => {
  let svc: MockReservaOnlineService;
  beforeEach(() => {
    svc = prepararServicio();
    push.mockClear();
  });
  afterEach(() => setServiceParaTests(null));

  const montar = () => renderWithProviders(<ReservasOnlineSettings slug="nails-by-natalie" />);
  const interruptor = () => screen.findByRole('switch', { name: 'Aceptar reservas online' });

  it('mientras carga, muestra un esqueleto en vez del texto plano "Cargando…"', () => {
    montar();
    expect(screen.getByTestId('reservas-online-settings-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('el esqueleto desaparece apenas los ajustes estan listos', async () => {
    montar();
    expect(screen.getByTestId('reservas-online-settings-skeleton')).toBeInTheDocument();
    await interruptor();
    expect(screen.queryByTestId('reservas-online-settings-skeleton')).toBeNull();
  });

  it('arranca inactivo y con el link bloqueado', async () => {
    montar();
    expect(await interruptor()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('El link se habilita cuando activás las reservas online.')).toBeInTheDocument();
  });

  it('activar el toggle no depende de Mercado Pago: persiste y habilita el link directo', async () => {
    montar();
    await userEvent.click(await interruptor());
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    expect((await svc.getSettings()).habilitada).toBe(true);
    expect(screen.getByText('localhost:3000/reservar/nails-by-natalie')).toBeInTheDocument();
  });

  it('no muestra ninguna tarjeta ni afordancia de Mercado Pago', async () => {
    montar();
    await interruptor();
    expect(screen.queryByText(/Mercado Pago/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conectar Mercado Pago' })).toBeNull();
  });

  it('no muestra los campos de seña/ventanas de la tarjeta vieja, y en cambio manda a Seña y pagos', async () => {
    montar();
    await interruptor();
    expect(screen.queryByLabelText('Seña')).toBeNull();
    expect(screen.queryByLabelText('Tiempo para pagar')).toBeNull();
    expect(screen.queryByLabelText('Reservar con antelación')).toBeNull();
    expect(screen.queryByLabelText('Cancelación gratis hasta')).toBeNull();

    expect(screen.getByText('El monto de la seña se configura en Seña y pagos.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir a Seña y pagos' }));
    expect(push).toHaveBeenCalledWith('/perfil');
  });

  it('con NEXT_PUBLIC_RESERVA_BASE_URL el link es <base>/<slug> (ej. reservar.turnetto.com/natalia)', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_BASE_URL', 'https://reservar.turnetto.com');
    await svc.saveSettings({ habilitada: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();
    expect(await screen.findByText('reservar.turnetto.com/nails-by-natalie')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://reservar.turnetto.com/nails-by-natalie');
    vi.unstubAllEnvs();
  });

  it('Enviar abre WhatsApp con el link en el mensaje', async () => {
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
    await svc.saveSettings({ habilitada: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/reservar/nails-by-natalie');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('desactivar el toggle vuelve a bloquear el link', async () => {
    await svc.saveSettings({ habilitada: true });
    montar();
    await userEvent.click(await interruptor());
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('El link se habilita cuando activás las reservas online.')).toBeInTheDocument();
  });
});
