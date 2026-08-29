import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The store pulls the axios instance (`@/lib/api`) both directly and through
// `authService`. Mock the instance so every network call is controllable.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/lib/api';
import { useAuthStore } from './useAuthStore';

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);

const INITIAL = useAuthStore.getState();

function resetStore() {
  useAuthStore.setState({
    ...INITIAL,
    user: null,
    token: null,
    inicializado: false,
    debeCambiarPassword: false,
    emailPendiente: null,
    subscriptionExpired: false,
    authStatus: 'booting',
    subscriptionChecked: false,
    sessionEndOrigin: '',
  });
}

/** subscription-status + me + support-info all resolve, sub is ACTIVO. */
function mockHealthyChecks() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/auth/subscription-status') {
      return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
    }
    if (url === '/support-info') {
      return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
    }
    if (url === '/auth/me') {
      return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  resetStore();
  mockedGet.mockReset();
  mockedPost.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('inicializar — boot gate', () => {
  it('no token -> authStatus becomes unauthenticated', () => {
    useAuthStore.getState().inicializar();
    expect(useAuthStore.getState().authStatus).toBe('unauthenticated');
  });

  it('token present -> stays booting until checkSubscription settles, then authenticated', async () => {
    localStorage.setItem('auth_token', 'tok');
    let resolveStatus!: (v: unknown) => void;
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return new Promise((res) => {
          resolveStatus = res;
        });
      }
      return Promise.resolve({ data: {} });
    });

    useAuthStore.getState().inicializar();
    expect(useAuthStore.getState().authStatus).toBe('booting');
    expect(useAuthStore.getState().subscriptionChecked).toBe(false);

    resolveStatus({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
    await vi.waitFor(() => expect(useAuthStore.getState().subscriptionChecked).toBe(true));
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
  });

  it('token present + expired subscription -> subscription-blocked', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -1, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });

    useAuthStore.getState().inicializar();
    await vi.waitFor(() => expect(useAuthStore.getState().subscriptionChecked).toBe(true));
    expect(useAuthStore.getState().authStatus).toBe('subscription-blocked');
  });

  it('boot checkSubscription throws -> subscriptionChecked true, authStatus authenticated (fail-open)', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockRejectedValue(new Error('network down'));

    useAuthStore.getState().inicializar();
    await vi.waitFor(() => expect(useAuthStore.getState().subscriptionChecked).toBe(true));
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
    expect(useAuthStore.getState().subscriptionExpired).toBe(false);
  });
});

describe('login', () => {
  it('success -> dispatches LOGIN_OK and lands authenticated', async () => {
    mockedPost.mockResolvedValue({
      data: { user: { id: 1, slug: 'salon', locale: 'es' }, token: 'tok' },
    });
    mockHealthyChecks();

    useAuthStore.getState().inicializar(); // no token -> unauthenticated
    const ok = await useAuthStore.getState().login('a@b.com', 'pw');

    expect(ok).toBe(true);
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
  });

  it('debe_cambiar_password branch -> dispatches MUST_CHANGE_PW', async () => {
    mockedPost.mockResolvedValue({
      data: { debe_cambiar_password: true, email: 'a@b.com', message: 'x' },
    });

    useAuthStore.getState().inicializar();
    await useAuthStore.getState().login('a@b.com', 'pw');

    expect(useAuthStore.getState().authStatus).toBe('must-change-password');
  });
});

describe('logout', () => {
  it('dispatches LOGOUT -> authStatus unauthenticated', async () => {
    useAuthStore.setState({ authStatus: 'authenticated', token: 'tok' });
    mockedPost.mockResolvedValue({ data: {} });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().authStatus).toBe('unauthenticated');
  });
});
