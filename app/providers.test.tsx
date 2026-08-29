import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/lib/api';
import Providers from './providers';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

const mockedGet = vi.mocked(api.get);

function markI18nReady() {
  act(() => {
    useLocaleStore.setState({ mensajesListos: true });
  });
}

beforeEach(() => {
  resetNavigationMock();
  mockedGet.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({
    token: null,
    user: null,
    inicializado: false,
    authStatus: 'booting',
    subscriptionChecked: false,
    subscriptionExpired: false,
    mostrarBienvenida: false,
  });
  useLocaleStore.setState({ mensajesListos: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Providers — boot gate', () => {
  it('token present + checkSubscription pending -> renders blank, not the protected children', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockReturnValue(new Promise(() => {})); // never settles

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('booting'));
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
  });

  it('checkSubscription resolves ACTIVO -> protected children render', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('PROTECTED CONTENT')).toBeInTheDocument();
  });

  it('false-expiry-flash regression: genuinely-expired user never renders protected children, goes to /subscription-expired', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/subscription-expired'));
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
  });
});

describe('Providers — unauthenticated redirect', () => {
  it('no token on a protected route -> pushes /login with origin', async () => {
    setMockLocation('/clientes/5', '?tab=historia');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/clientes/5?tab=historia')}`,
      ),
    );
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
  });
});
