import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProError } from '@/lib/pro/errores';

const nav = vi.hoisted(() => ({ pathname: '/restablecer-password', push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));

const svc = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock('@/services/proService', () => ({ proService: svc }));
vi.mock('@/lib/proApi', () => ({ proErrorDe: (e: { pro: ProError }) => e.pro }));

import { RestablecerForm } from './RestablecerForm';

const CLAVE = 'una-clave-larga-1';

beforeEach(() => {
  nav.pathname = '/restablecer-password';
  nav.search = '';
  nav.push.mockClear();
  svc.resetPassword.mockReset();
  svc.resetPassword.mockResolvedValue(undefined);
  window.history.replaceState(null, '', '/restablecer-password');
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function llenar({ email = 'ana@x.com', code = '123456', nueva = CLAVE, confirmar = CLAVE } = {}) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: code } });
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña nueva'), { target: { value: confirmar } });
}

async function guardar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
  });
}

describe('RestablecerForm', () => {
  describe('campo del código', () => {
    it('es numérico, de 6 dígitos y sugiere el código de un solo uso', () => {
      renderWithProviders(<RestablecerForm />);
      const codigo = screen.getByLabelText('Código de 6 dígitos');
      expect(codigo).toHaveAttribute('inputmode', 'numeric');
      expect(codigo).toHaveAttribute('autocomplete', 'one-time-code');
      expect(codigo).toHaveAttribute('maxlength', '6');
      expect(codigo.style.minHeight).toBe('44px');
    });

    it('quita todo lo que no es dígito y corta en 6', () => {
      renderWithProviders(<RestablecerForm />);
      const codigo = screen.getByLabelText('Código de 6 dígitos') as HTMLInputElement;
      fireEvent.change(codigo, { target: { value: '12a-34 56789' } });
      expect(codigo.value).toBe('123456');
    });

    it('el botón queda deshabilitado hasta tener 6 dígitos', () => {
      renderWithProviders(<RestablecerForm />);
      const boton = screen.getByRole('button', { name: 'Guardar contraseña' });
      fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '12345' } });
      expect(boton).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } });
      expect(boton).toBeEnabled();
    });
  });

  describe('contraseña', () => {
    it('menos de 10 caracteres: error en línea y no llama al servicio', async () => {
      renderWithProviders(<RestablecerForm />);
      llenar({ nueva: 'corta', confirmar: 'corta' });
      await guardar();

      expect(svc.resetPassword).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('al menos 10 caracteres');
      expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-invalid', 'true');
    });

    it('confirmación distinta: error en línea y no llama al servicio', async () => {
      renderWithProviders(<RestablecerForm />);
      llenar({ confirmar: 'otra-clave-larga-1' });
      await guardar();

      expect(svc.resetPassword).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    });

    it('correo vacío: lo pide y no llama al servicio', async () => {
      renderWithProviders(<RestablecerForm />);
      llenar({ email: '  ' });
      await guardar();

      expect(svc.resetPassword).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Ingresá tu correo');
    });
  });

  describe('éxito', () => {
    it('envía exactamente los cuatro campos, avisa, ofrece ir a ingresar y no inicia sesión ni navega', async () => {
      renderWithProviders(<RestablecerForm />);
      llenar({ email: ' ana@x.com ' });
      await guardar();

      expect(svc.resetPassword).toHaveBeenCalledWith({
        email: 'ana@x.com',
        code: '123456',
        password: CLAVE,
        password_confirmation: CLAVE,
      });
      expect(screen.getByRole('status')).toHaveTextContent('cambiaste tu contraseña');
      expect(screen.getByRole('link', { name: 'Ir a ingresar' }).getAttribute('href')).toBe('/login');
      expect(nav.push).not.toHaveBeenCalled();
      expect(window.localStorage.length).toBe(0);
      expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
    });

    it('en localhost el link a ingresar lleva el prefijo /pro', async () => {
      nav.pathname = '/pro/restablecer-password';
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();
      expect(screen.getByRole('link', { name: 'Ir a ingresar' }).getAttribute('href')).toBe('/pro/login');
    });
  });

  describe('errores', () => {
    it.each<[string, ProError]>([
      ['code', { kind: 'validation', fields: { code: ['inválido'] } }],
      ['email', { kind: 'validation', fields: { email: ['no existe'] } }],
      ['sin campos', { kind: 'validation', fields: {} }],
    ])('validación en %s: UN solo mensaje genérico, conserva los valores y ofrece pedir otro código', async (_n, pro) => {
      svc.resetPassword.mockRejectedValue({ pro });
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();

      expect(screen.getByRole('alert')).toHaveTextContent('El código no es válido o venció');
      expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('123456');
      expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@x.com');
      expect(screen.getByLabelText('Contraseña nueva')).toHaveValue(CLAVE);
      expect(screen.getByRole('link', { name: 'Pedir un código nuevo' }).getAttribute('href')).toBe('/olvide-password');
    });

    it('validación solo de contraseña: copy de validación, no el del código', async () => {
      svc.resetPassword.mockRejectedValue({ pro: { kind: 'validation', fields: { password: ['débil'] } } });
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();
      expect(screen.getByRole('alert')).toHaveTextContent('Revisá los datos ingresados');
    });

    it('401 clasificado como server: copy de servidor, nunca de credenciales ni de sesión', async () => {
      svc.resetPassword.mockRejectedValue({ pro: { kind: 'server' } });
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();
      expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado');
    });

    it('429: muestra el límite con cuenta regresiva y bloquea el envío hasta que termine', async () => {
      vi.useFakeTimers();
      svc.resetPassword.mockRejectedValue({ pro: { kind: 'rateLimited', retryAfterSec: 20, lockout: false } });
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();

      expect(screen.getByRole('alert')).toHaveTextContent('20 segundos');
      expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled();
    });

    it('404: copy de portal no disponible', async () => {
      svc.resetPassword.mockRejectedValue({ pro: { kind: 'portalUnavailable' } });
      renderWithProviders(<RestablecerForm />);
      llenar();
      await guardar();
      expect(screen.getByRole('alert')).toHaveTextContent('El portal no está disponible');
    });
  });

  it('no duplica el envío mientras hay una petición en curso', async () => {
    let resolver!: () => void;
    svc.resetPassword.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    renderWithProviders(<RestablecerForm />);
    llenar();
    const form = screen.getByLabelText('Contraseña nueva').closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(svc.resetPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled();
    await act(async () => resolver());
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  describe('datos que vienen en la URL', () => {
    it('precarga el correo y el código y limpia la URL (la ruta queda, la query no)', () => {
      nav.search = 'email=ana%40x.com&code=654321';
      window.history.replaceState(null, '', '/restablecer-password?email=ana%40x.com&code=654321');
      const reemplazo = vi.spyOn(window.history, 'replaceState');
      renderWithProviders(<RestablecerForm />);

      expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@x.com');
      expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('654321');
      expect(reemplazo).toHaveBeenCalled();
      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/restablecer-password');
    });

    it('un código con basura en la URL se sanea igual que si se tipeara', () => {
      nav.search = 'code=12ab34cd5678';
      renderWithProviders(<RestablecerForm />);
      expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('123456');
    });

    it('si la URL no trae nada no toca el historial', () => {
      const reemplazo = vi.spyOn(window.history, 'replaceState');
      renderWithProviders(<RestablecerForm />);
      expect(reemplazo).not.toHaveBeenCalled();
    });

    it('también limpia el hash', () => {
      window.history.replaceState(null, '', '/restablecer-password#code=123456');
      renderWithProviders(<RestablecerForm />);
      expect(window.location.hash).toBe('');
    });
  });

  it('nunca escribe el código ni las contraseñas en consola', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    svc.resetPassword.mockRejectedValue({ pro: { kind: 'validation', fields: { code: ['x'] } } });
    renderWithProviders(<RestablecerForm />);
    llenar();
    await guardar();
    const salida = JSON.stringify(espias.flatMap((e) => e.mock.calls));
    expect(salida).not.toContain('123456');
    expect(salida).not.toContain(CLAVE);
  });
});
