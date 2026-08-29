import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/adminService', () => ({
  adminService: {
    getToken: vi.fn(),
    getAdminGuardado: vi.fn(() => null),
  },
}));

import { adminService } from '@/services/adminService';
import AdminLayout from './layout';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';

const mockedGetToken = vi.mocked(adminService.getToken);

beforeEach(() => {
  resetNavigationMock();
  useAdminAuthStore.setState({ admin: null, token: null, inicializado: false });
  mockedGetToken.mockReset();
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
});
