import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProError } from '@/lib/pro/errores';

const nav = vi.hoisted(() => ({ pathname: '/olvide-password', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));

const svc = vi.hoisted(() => ({ forgotPassword: vi.fn() }));
vi.mock('@/services/proService', () => ({ proService: svc }));
// El clasificador real vive en proApi (axios); acá el error ya viene clasificado.
vi.mock('@/lib/proApi', () => ({ proErrorDe: (e: { pro: ProError }) => e.pro }));

import { OlvidePasswordForm } from './OlvidePasswordForm';
import { leerCorreoPendiente, limpiarCorreoPendiente } from './correoPendiente';

beforeEach(() => {
  nav.pathname = '/olvide-password';
  nav.push.mockClear();
  svc.forgotPassword.mockReset();
  svc.forgotPassword.mockResolvedValue(undefined);
  limpiarCorreoPendiente();
});

afterEach(() => {
  vi.useRealTimers();
});

async function enviar(email = 'ana@x.com') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  });
}

const CONFIRMACION = /Si el correo corresponde a una cuenta/;

describe('OlvidePasswordForm', () => {
  it('éxito: muestra la confirmación genérica y el paso del código con el correo recortado', async () => {
    renderWithProviders(<OlvidePasswordForm />);
    await enviar('  ana@x.com  ');

    expect(svc.forgotPassword).toHaveBeenCalledWith('ana@x.com');
    expect(screen.getByText(CONFIRMACION)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Ya tengo el código' });
    expect(link.getAttribute('href')).toBe('/restablecer-password');
    expect(leerCorreoPendiente()).toBe('ana@x.com');
  });

  it('en localhost el link del código lleva el prefijo /pro', async () => {
    nav.pathname = '/pro/olvide-password';
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();
    expect(screen.getByRole('link', { name: 'Ya tengo el código' }).getAttribute('href')).toBe(
      '/pro/restablecer-password',
    );
  });

  it.each<[string, ProError]>([
    ['validation', { kind: 'validation', fields: { email: ['no existe'] } }],
    ['notFound', { kind: 'notFound' }],
    ['vinculoRequired', { kind: 'vinculoRequired' }],
  ])('%s: la misma confirmación genérica, sin revelar si la cuenta existe', async (_n, pro) => {
    svc.forgotPassword.mockRejectedValue({ pro });
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();

    expect(screen.getByText(CONFIRMACION)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('429 con espera: muestra el límite con cuenta regresiva, sin confirmación, y bloquea el reenvío', async () => {
    vi.useFakeTimers();
    svc.forgotPassword.mockRejectedValue({ pro: { kind: 'rateLimited', retryAfterSec: 30, lockout: false } });
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('Hubo demasiados intentos');
    expect(screen.getByRole('alert')).toHaveTextContent('30 segundos');
    expect(screen.queryByText(CONFIRMACION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeEnabled();
  });

  it('404: muestra el copy de portal no disponible, no uno que distinga cuentas', async () => {
    svc.forgotPassword.mockRejectedValue({ pro: { kind: 'portalUnavailable' } });
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('El portal no está disponible por ahora');
    expect(screen.queryByText(CONFIRMACION)).toBeNull();
  });

  it('sin conexión: error de red, no la confirmación (el correo no llegó)', async () => {
    svc.forgotPassword.mockRejectedValue({ pro: { kind: 'network' } });
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos');
    expect(screen.queryByText(CONFIRMACION)).toBeNull();
  });

  it('500 / 401 clasificado como server: muestra el error de servidor, no la confirmación', async () => {
    svc.forgotPassword.mockRejectedValue({ pro: { kind: 'server' } });
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado');
    expect(screen.queryByText(CONFIRMACION)).toBeNull();
  });

  it('un correo con forma inválida se rechaza en el cliente sin llamar al servicio', async () => {
    renderWithProviders(<OlvidePasswordForm />);
    await enviar('ana@');

    expect(svc.forgotPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Revisá el correo');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
  });

  it('correo vacío: error en el campo y no llama al servicio', async () => {
    renderWithProviders(<OlvidePasswordForm />);
    await enviar('   ');

    expect(svc.forgotPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá tu correo');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
  });

  it('no duplica el envío: con una petición en curso muestra el spinner y un segundo submit se ignora', async () => {
    let resolver!: () => void;
    svc.forgotPassword.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    renderWithProviders(<OlvidePasswordForm />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@x.com' } });
    const form = screen.getByLabelText('Correo electrónico').closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(svc.forgotPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Enviando/ })).toBeDisabled();
    await act(async () => resolver());
    expect(screen.getByText(CONFIRMACION)).toBeInTheDocument();
  });

  it('tiene la etiqueta asociada, tap target de 44px, autocomplete de usuario y link para volver al ingreso', () => {
    renderWithProviders(<OlvidePasswordForm />);
    const input = screen.getByLabelText('Correo electrónico');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input.style.minHeight).toBe('44px');
    expect(screen.getByRole('link', { name: 'Volver a ingresar' }).getAttribute('href')).toBe('/login');
  });

  it('nunca navega por su cuenta', async () => {
    renderWithProviders(<OlvidePasswordForm />);
    await enviar();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
