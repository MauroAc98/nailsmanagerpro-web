import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import AdminLoginPage from './page';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';

const entrar = async () => {
  fireEvent.change(screen.getByPlaceholderText('admin@turnetto.app'), { target: { value: 'admin@turnetto.app' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secreto123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
};

beforeEach(() => {
  resetNavigationMock();
  useAdminAuthStore.setState({ login: vi.fn().mockResolvedValue(true), loading: false, error: null });
});

describe('AdminLoginPage — a dónde va después de entrar', () => {
  it('en admin.turnetto.com (URLs limpias) va a /', async () => {
    setMockLocation('/login');
    render(<AdminLoginPage />);
    await entrar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/'));
  });

  it('con el panel bajo /admin (localhost, app.turnetto.com/admin) va a /admin, no a la raíz del salón', async () => {
    setMockLocation('/admin/login');
    render(<AdminLoginPage />);
    await entrar();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/admin'));
    expect(routerMock.push).not.toHaveBeenCalledWith('/');
  });
});
