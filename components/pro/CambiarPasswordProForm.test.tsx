import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProError } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/cambiar-password',
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));

import { CambiarPasswordProForm } from './CambiarPasswordProForm';

const VALIDA = 'una-clave-larga-1';
let cambiarPassword: ReturnType<typeof vi.fn>;
let logout: ReturnType<typeof vi.fn>;

beforeEach(() => {
  nav.push.mockClear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  cambiarPassword = vi.fn().mockResolvedValue(null);
  logout = vi.fn().mockResolvedValue(undefined);
  useProAuthStore.setState({ status: 'restricted', token: 'tok', cambiarPassword, logout });
});

function escribir(nueva = VALIDA, confirmacion = VALIDA) {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña nueva'), { target: { value: confirmacion } });
}

async function enviar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
  });
}

describe('CambiarPasswordProForm', () => {
  it('con datos válidos llama al store y no navega', async () => {
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    expect(cambiarPassword).toHaveBeenCalledWith(VALIDA, VALIDA);
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('menos de 10 caracteres: error en el campo y no llama al store', async () => {
    renderWithProviders(<CambiarPasswordProForm />);
    escribir('corta', 'corta');
    await enviar();

    expect(cambiarPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 10 caracteres');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  });

  it('confirmación distinta: error en la confirmación y no llama al store', async () => {
    renderWithProviders(<CambiarPasswordProForm />);
    escribir(VALIDA, VALIDA + 'x');
    await enviar();

    expect(cambiarPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    expect(screen.getByLabelText('Repetí la contraseña nueva')).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  });

  it('validación del servidor: se muestra junto al campo con el copy propio, no el texto del backend', async () => {
    const error: ProError = { kind: 'validation', fields: { password: ['The password is too common SECRETO'] } };
    cambiarPassword.mockResolvedValue(error);
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('Revisá los datos ingresados.');
    expect(screen.queryByText(/SECRETO/)).toBeNull();
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-invalid', 'true');
  });

  it('otros errores (red) se muestran con su copy y conservan lo escrito', async () => {
    cambiarPassword.mockResolvedValue({ kind: 'network' });
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue(VALIDA);
  });

  it('sesión revocada: no muestra nada propio (el guard lleva al ingreso con aviso)', async () => {
    cambiarPassword.mockResolvedValue({ kind: 'sessionRevoked' });
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('cerrar sesión llama al store', () => {
    renderWithProviders(<CambiarPasswordProForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('autocomplete new-password en ambos campos', () => {
    renderWithProviders(<CambiarPasswordProForm />);
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Repetí la contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('mientras guarda deshabilita el botón, muestra Spinner y no duplica el envío', async () => {
    let resolver: (v: ProError | null) => void = () => {};
    cambiarPassword.mockImplementation(() => new Promise((r) => { resolver = r; }));
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    const boton = screen.getByRole('button', { name: /Guardando/ });
    expect(boton).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Guardando' })).toBeInTheDocument();
    fireEvent.submit(boton.closest('form')!);
    expect(cambiarPassword).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver(null);
    });
  });

  it('objetivos táctiles de 44 px', () => {
    renderWithProviders(<CambiarPasswordProForm />);
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveStyle({ minHeight: '44px' });
  });

  it('la contraseña no se registra en consola', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    cambiarPassword.mockResolvedValue({ kind: 'server' });
    renderWithProviders(<CambiarPasswordProForm />);
    escribir();
    await enviar();

    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(VALIDA);
    expect(screen.queryByText(VALIDA)).toBeNull();
    vi.restoreAllMocks();
  });
});
