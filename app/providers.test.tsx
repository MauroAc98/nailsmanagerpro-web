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
    subscriptionCheckFailed: false,
    sessionEndOrigin: '',
    subscriptionBlockedOrigin: '',
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

  it('capturing the blocked-from route: expired user on a deep protected route -> subscriptionBlockedOrigin set before the redirect', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/clientes/5', '?tab=historia');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/subscription-expired'));
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('/clientes/5?tab=historia');
  });

  it('does not capture a non-protected route (already on /subscription-expired stays empty)', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/subscription-expired');
    render(<Providers><div>BLOCKED PAGE</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('subscription-blocked'));
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('');
  });

  it('server-revoked token at boot: all boot requests 401 -> lands unauthenticated on /login, never paints protected content, no modal', async () => {
    localStorage.setItem('auth_token', 'stale-revoked');
    // Every boot request 401s. The real axios interceptor clears storage and
    // emits `auth:session-revoked` from its async rejection handler; `@/lib/api`
    // is mocked here so mirror that side effect on a macrotask (by which point
    // the providers listener effect has run).
    mockedGet.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('auth:session-revoked'));
            reject({ response: { status: 401 } });
          }, 0);
        }),
    );

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('unauthenticated'));
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().subscriptionChecked).toBe(true);
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    // Silent bounce to /login with the origin preserved — no session-ended modal
    // (the user never got in, there is no dimmed screen to keep).
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/agenda')}`,
      ),
    );
    expect(screen.queryByText('Tu sesión se cerró')).toBeNull();
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

describe('Providers — graceful session revocation', () => {
  function mockActiveChecks() {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  }

  it('auth:session-revoked -> modal appears and the current screen is NOT blanked', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockActiveChecks();
    setMockLocation('/agenda');

    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();
    expect(await screen.findByText('PROTECTED CONTENT')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:session-revoked'));
    });

    expect(await screen.findByText('Tu sesión se cerró')).toBeInTheDocument();
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    expect(useAuthStore.getState().authStatus).toBe('session-ending');
  });

  it('auth:subscription-suspect -> runs an authoritative recheck against /auth/subscription-status', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockActiveChecks();
    setMockLocation('/agenda');

    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();
    await screen.findByText('PROTECTED CONTENT');

    const before = mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status').length;
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:subscription-suspect'));
    });

    await waitFor(() =>
      expect(
        mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status').length,
      ).toBe(before + 1),
    );
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
