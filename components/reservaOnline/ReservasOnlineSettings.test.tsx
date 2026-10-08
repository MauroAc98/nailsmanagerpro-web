import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import { ReservasOnlineSettings } from './ReservasOnlineSettings';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Esta pantalla solo se abre con la reserva online ya activada por el admin
// (ver la página), así que NO tiene interruptor propio: el link, el QR y los
// botones de compartir se ven siempre. El interruptor que había era un mock
// guardado en el navegador que no controlaba nada real.
function setUser(parcial: Partial<User>) {
  useAuthStore.setState({
    user: {
      sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000,
      retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...parcial,
    } as User,
  });
}

describe('ReservasOnlineSettings', () => {
  beforeEach(() => {
    push.mockClear();
    setUser({});
  });

  const montar = () => renderWithProviders(<ReservasOnlineSettings slug="nails-by-natalie" />);

  it('muestra el link, Copiar, Enviar y Ver QR de entrada, sin interruptor ni mensaje de link bloqueado', () => {
    montar();
    expect(screen.getByText('localhost:3000/reservar/nails-by-natalie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enviar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver QR' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/El link se habilita/)).toBeNull();
    expect(screen.queryByText('Aceptar reservas online')).toBeNull();
  });

  it('no muestra ninguna tarjeta ni afordancia de Mercado Pago', () => {
    montar();
    expect(screen.queryByText(/Mercado Pago/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conectar Mercado Pago' })).toBeNull();
  });

  it('no muestra los campos de la tarjeta vieja (seña, ventana de pago, antelación, cancelación)', () => {
    montar();
    expect(screen.queryByLabelText('Seña')).toBeNull();
    expect(screen.queryByLabelText('Tiempo para pagar')).toBeNull();
    expect(screen.queryByLabelText('Reservar con antelación')).toBeNull();
    expect(screen.queryByLabelText('Cancelación gratis hasta')).toBeNull();
  });

  it('muestra la seña actual en monto fijo', () => {
    montar();
    expect(screen.getByText('Seña actual: $5.000,00')).toBeInTheDocument();
  });

  it('muestra la seña actual en porcentaje', () => {
    setUser({ sena_tipo: 'porcentaje', sena_porcentaje: 30, sena_monto: null });
    montar();
    expect(screen.getByText('Seña actual: 30% del precio')).toBeInTheDocument();
  });

  it('con la seña sin configurar lo dice y ofrece configurarla', async () => {
    setUser({ sena_tipo: 'fijo', sena_monto: null });
    montar();
    expect(screen.getByText('Todavía no configuraste la seña de tus reservas.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Configurar' }));
    expect(push).toHaveBeenCalledWith('/perfil?sheet=senaYPagos');
  });

  it('incluye los avisos de reservas online (viven acá, junto al link y la seña, no sueltos en Perfil)', () => {
    montar();
    expect(screen.getByText('Avisos de reservas online')).toBeInTheDocument();
  });

  it('"Cambiar" abre Seña y pagos directo', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(push).toHaveBeenCalledWith('/perfil?sheet=senaYPagos');
  });

  it('con NEXT_PUBLIC_RESERVA_BASE_URL el link es <base>/<slug> (ej. reservar.turnetto.com/natalia)', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_BASE_URL', 'https://reservar.turnetto.com');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();
    expect(screen.getByText('reservar.turnetto.com/nails-by-natalie')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('https://reservar.turnetto.com/nails-by-natalie');
    vi.unstubAllEnvs();
  });

  it('Enviar abre WhatsApp con el link en el mensaje', () => {
    montar();
    const enviar = screen.getByRole('link', { name: 'Enviar' });
    const href = new URL(enviar.getAttribute('href') as string);
    expect(href.origin).toBe('https://wa.me');
    expect(href.searchParams.get('text')).toBe(
      'Reservá tu turno online acá: http://localhost:3000/reservar/nails-by-natalie',
    );
  });

  it('Copiar escribe el link en el portapapeles y confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/reservar/nails-by-natalie');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });
});
