import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/adminService', () => ({
  adminService: {
    getToken: vi.fn(),
    getAdminGuardado: vi.fn(() => null),
    tokenExpirado: vi.fn(() => false),
  },
}));

import { adminService } from '@/services/adminService';
import AdminLayout from './layout';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';

const mockedGetToken = vi.mocked(adminService.getToken);
const mockedTokenExpirado = vi.mocked(adminService.tokenExpirado);

beforeEach(() => {
  resetNavigationMock();
  useAdminAuthStore.setState({ admin: null, token: null, inicializado: false, reautenticacionRequerida: false });
  mockedGetToken.mockReset();
  mockedTokenExpirado.mockReset();
  mockedTokenExpirado.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminLayout — shared resolver', () => {
  it('unauthenticated on a protected admin route -> pushes /login with origin preserved', async () => {
    mockedGetToken.mockReturnValue(null);
    setMockLocation('/suscripciones');

    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/suscripciones')}`,
      ),
    );
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  it('authenticated on /login -> pushes / (admin home override, not /agenda)', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/login');

    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/'));
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
  });

  // Fuera de admin.turnetto.com (localhost, app.turnetto.com/admin) el panel vive
  // bajo /admin: su login es /admin/login, no el /login del salón.
  it('bajo /admin, sin sesión -> va a /admin/login (no al login del salón) con el origen', async () => {
    mockedGetToken.mockReturnValue(null);
    setMockLocation('/admin');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/admin/login?redirect=${encodeURIComponent('/admin')}`),
    );
    expect(routerMock.push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/login/));
  });

  it('bajo /admin, sin sesión y ya en /admin/login -> muestra el login, sin redirigir', async () => {
    mockedGetToken.mockReturnValue(null);
    setMockLocation('/admin/login');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    expect(await screen.findByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('bajo /admin, con sesión en /admin/login -> va a /admin', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/admin/login');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/admin'));
  });

  it('bajo /admin, con sesión en /admin -> muestra el contenido', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/admin');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    expect(await screen.findByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('authenticated on / -> renders children', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/');

    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);

    expect(await screen.findByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('admin-session-expired event pide reautenticación sin desmontar la pantalla ni tocar tenant auth', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    await screen.findByText('ADMIN CONTENT');

    act(() => {
      window.dispatchEvent(new CustomEvent('admin-session-expired'));
    });

    await waitFor(() => expect(useAdminAuthStore.getState().reautenticacionRequerida).toBe(true));
    // La pantalla (y cualquier formulario sin guardar que tuviera) sigue montada.
    expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(useAdminAuthStore.getState().token).toBe('admin-tok');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('token ya vencido al montar (pestaña nueva después de las 12h) -> nunca pinta admin, va directo a /login', async () => {
    mockedGetToken.mockReturnValue('admin-tok-viejo');
    mockedTokenExpirado.mockReturnValue(true);
    setMockLocation('/');

    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/')}`),
    );
    expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
  });

  describe('sincronización entre pestañas (evento storage)', () => {
    const mockedGetAdmin = vi.mocked(adminService.getAdminGuardado);
    const ADMIN = { id: 1, name: 'Superadmin', email: 'admin@turnetto.app' };

    const storageEvent = (key: string | null) =>
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key }));
      });

    it('otra pestaña borra admin_token (logout) -> esta pestaña queda sin sesión y va al login', async () => {
      mockedGetToken.mockReturnValue('admin-tok');
      setMockLocation('/');
      render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');

      mockedGetToken.mockReturnValue(null);
      storageEvent('admin_token');

      await waitFor(() => expect(useAdminAuthStore.getState().token).toBeNull());
      await waitFor(() =>
        expect(routerMock.push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/')}`),
      );
      expect(screen.queryByText('ADMIN CONTENT')).toBeNull();
    });

    it('otra pestaña inicia sesión -> esta pestaña adopta el token nuevo', async () => {
      mockedGetToken.mockReturnValue(null);
      setMockLocation('/login');
      render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');

      mockedGetToken.mockReturnValue('tok-de-otra-pestana');
      mockedGetAdmin.mockReturnValue(ADMIN);
      storageEvent('admin_token_expires_at');

      await waitFor(() => expect(useAdminAuthStore.getState().token).toBe('tok-de-otra-pestana'));
      expect(useAdminAuthStore.getState().admin).toEqual(ADMIN);
    });

    it('cambia admin_user -> sincroniza', async () => {
      mockedGetToken.mockReturnValue('admin-tok');
      setMockLocation('/');
      render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');

      mockedGetAdmin.mockReturnValue(ADMIN);
      storageEvent('admin_user');

      await waitFor(() => expect(useAdminAuthStore.getState().admin).toEqual(ADMIN));
    });

    it('storage.clear() en otra pestaña (key null) -> sincroniza', async () => {
      mockedGetToken.mockReturnValue('admin-tok');
      setMockLocation('/');
      render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');

      mockedGetToken.mockReturnValue(null);
      storageEvent(null);

      await waitFor(() => expect(useAdminAuthStore.getState().token).toBeNull());
    });

    it('claves del salón (auth_token/auth_user) o ajenas se ignoran', async () => {
      mockedGetToken.mockReturnValue('admin-tok');
      setMockLocation('/');
      render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');

      mockedGetToken.mockReturnValue(null); // si sincronizara, perdería la sesión
      storageEvent('auth_token');
      storageEvent('auth_user');
      storageEvent('otra_cosa');

      expect(useAdminAuthStore.getState().token).toBe('admin-tok');
      expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    });

    it('al desmontar quita el listener', async () => {
      mockedGetToken.mockReturnValue('admin-tok');
      setMockLocation('/');
      const { unmount } = render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
      await screen.findByText('ADMIN CONTENT');
      unmount();

      mockedGetToken.mockReturnValue(null);
      storageEvent('admin_token');

      expect(useAdminAuthStore.getState().token).toBe('admin-tok');
    });
  });

  it('token vence mientras la pestaña está en background -> al volver a visible, pide reautenticación sin esperar un request ni perder la pantalla', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    mockedTokenExpirado.mockReturnValue(false);
    setMockLocation('/');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    await screen.findByText('ADMIN CONTENT');

    // El token vence mientras la pestaña está oculta — nadie hizo ningún
    // request todavía, así que un 401 no es lo que va a avisarnos.
    mockedTokenExpirado.mockReturnValue(true);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(useAdminAuthStore.getState().reautenticacionRequerida).toBe(true));
    expect(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(useAdminAuthStore.getState().token).toBe('admin-tok');
  });
});
