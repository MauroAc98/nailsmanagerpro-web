import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProError } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/login', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));

import { LoginProForm } from './LoginProForm';

let login: ReturnType<typeof vi.fn>;

beforeEach(() => {
  nav.pathname = '/login';
  nav.push.mockClear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  useProAuthStore.setState({ status: 'anonymous' });
  login = vi.fn().mockResolvedValue(null);
  useProAuthStore.setState({ login });
});

afterEach(() => {
  vi.useRealTimers();
});

function escribir(email = 'ana@x.com', password = 'una-clave-larga') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

async function enviar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  });
}

function respuesta(error: ProError | null) {
  login.mockResolvedValue(error);
}

describe('LoginProForm', () => {
  it('ingreso completo: llama al store con correo y contraseña y no navega', async () => {
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(login).toHaveBeenCalledWith('ana@x.com', 'una-clave-larga');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('quita los espacios del correo antes de enviarlo', async () => {
    renderWithProviders(<LoginProForm />);
    escribir('  ana@x.com  ');
    await enviar();
    expect(login).toHaveBeenCalledWith('ana@x.com', 'una-clave-larga');
  });

  it('si el store deja la sesión restringida, el formulario no navega ni muestra error', async () => {
    useProAuthStore.setState({ login: vi.fn().mockImplementation(async () => {
      useProAuthStore.setState({ status: 'restricted' });
      return null;
    }) });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('credenciales inválidas: un único mensaje genérico', async () => {
    respuesta({ kind: 'invalidCredentials' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    const alertas = screen.getAllByRole('alert');
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toHaveTextContent('El correo o la contraseña no son correctos.');
  });

  it('credenciales inválidas: vacía solo la contraseña y conserva el correo', async () => {
    respuesta({ kind: 'invalidCredentials' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@x.com');
  });

  it('mientras envía los campos quedan de solo lectura (no deshabilitados) y el form figura ocupado', async () => {
    let resolver: (v: ProError | null) => void = () => {};
    login.mockImplementation(() => new Promise((r) => { resolver = r; }));
    renderWithProviders(<LoginProForm />);
    escribir();
    const email = screen.getByLabelText('Correo electrónico');
    email.focus();
    await enviar();

    expect(email).toHaveAttribute('readonly');
    expect(email).not.toBeDisabled();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('readonly');
    expect(email.closest('form')).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      resolver(null);
    });
  });

  it('429 con espera: cuenta regresiva, envío deshabilitado y se rehabilita al cumplirse', async () => {
    vi.useFakeTimers();
    respuesta({ kind: 'rateLimited', retryAfterSec: 90, lockout: true });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('en 90 segundos');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('en 60 segundos');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('429 sin segundos: copy genérico y el envío sigue habilitado', async () => {
    respuesta({ kind: 'rateLimited', retryAfterSec: null, lockout: false });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('Hubo demasiados intentos. Esperá un momento');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/segundos/);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('portal no disponible se muestra como estado del portal, no como error de credenciales', async () => {
    respuesta({ kind: 'portalUnavailable' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('El portal no está disponible por ahora');
    expect(screen.queryByText(/no son correctos/)).toBeNull();
  });

  it('error de red: avisa y conserva lo escrito', async () => {
    respuesta({ kind: 'network' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@x.com');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('una-clave-larga');
  });

  it('campos vacíos no llaman al store y avisan', async () => {
    renderWithProviders(<LoginProForm />);
    await enviar();
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Completá el correo y la contraseña.');

    escribir('ana@x.com', '');
    await enviar();
    expect(login).not.toHaveBeenCalled();
  });

  it('atributos de los campos: correo con username y contraseña con current-password', () => {
    renderWithProviders(<LoginProForm />);
    const email = screen.getByLabelText('Correo electrónico');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('mientras envía muestra Spinner, deshabilita el botón y no duplica el envío', async () => {
    let resolver: (v: ProError | null) => void = () => {};
    login.mockImplementation(() => new Promise((r) => { resolver = r; }));
    renderWithProviders(<LoginProForm />);
    escribir();

    await enviar();
    expect(screen.getByRole('button', { name: /Ingresando/ })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Ingresando' })).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('button', { name: /Ingresando/ }).closest('form')!);
    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver(null);
    });
  });

  it('el link de olvidé mi contraseña usa la ruta del portal', () => {
    renderWithProviders(<LoginProForm />);
    expect(screen.getByRole('link', { name: 'Olvidé mi contraseña' })).toHaveAttribute('href', '/olvide-password');
  });

  it('en localhost el link lleva el prefijo /pro', () => {
    nav.pathname = '/pro/login';
    renderWithProviders(<LoginProForm />);
    expect(screen.getByRole('link', { name: 'Olvidé mi contraseña' })).toHaveAttribute('href', '/pro/olvide-password');
  });

  it('aviso de sesión vencida o revocada', () => {
    useProAuthStore.setState({ aviso: 'expired' });
    const { unmount } = renderWithProviders(<LoginProForm />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión venció');
    unmount();

    useProAuthStore.setState({ aviso: 'revoked' });
    renderWithProviders(<LoginProForm />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión se cerró');
  });

  it('sin aviso (carga nueva) no muestra ningún aviso', () => {
    renderWithProviders(<LoginProForm />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('accesibilidad: el error se asocia a los campos y los objetivos son de 44 px', async () => {
    respuesta({ kind: 'invalidCredentials' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    const alerta = screen.getByRole('alert');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-describedby', alerta.id);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-describedby', alerta.id);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByLabelText('Correo electrónico')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('link', { name: 'Olvidé mi contraseña' })).toHaveStyle({ minHeight: '44px' });
  });

  it('la contraseña no se registra en consola ni se pinta como texto', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    respuesta({ kind: 'invalidCredentials' });
    renderWithProviders(<LoginProForm />);
    escribir();
    await enviar();

    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('una-clave-larga');
    expect(screen.queryByText('una-clave-larga')).toBeNull();
    vi.restoreAllMocks();
  });
});
