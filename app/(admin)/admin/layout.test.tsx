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
  useAdminAuthStore.setState({ admin: null, token: null, inicializado: false });
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

  it('authenticated on / -> renders children', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/');

    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);

    expect(await screen.findByText('ADMIN CONTENT')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('admin-session-expired event clears only the admin store, never tenant auth', async () => {
    mockedGetToken.mockReturnValue('admin-tok');
    setMockLocation('/');
    render(<AdminLayout><div>ADMIN CONTENT</div></AdminLayout>);
    await screen.findByText('ADMIN CONTENT');

    act(() => {
      window.dispatchEvent(new CustomEvent('admin-session-expired'));
    });

    await waitFor(() => expect(useAdminAuthStore.getState().token).toBeNull());
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

  it('token vence mientras la pestaña está en background -> al volver a visible, corta sin esperar un request', async () => {
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

    await waitFor(() => expect(useAdminAuthStore.getState().token).toBeNull());
  });
});
