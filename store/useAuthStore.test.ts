import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The store pulls the axios instance (`@/lib/api`) both directly and through
// `authService`. Mock the instance so every network call is controllable.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('@/lib/logAuthEvent', () => ({
  logAuthEvent: vi.fn(),
}));

import api from '@/lib/api';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { useAuthStore } from './useAuthStore';

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);
const mockedLog = vi.mocked(logAuthEvent);

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
    subscriptionCheckFailed: false,
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
  mockedLog.mockReset();
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

describe('checkSubscription — per-call resilience (Promise.allSettled)', () => {
  it('me() rejects but subscription-status is ACTIVO -> not expired, no throw, failure logged', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 12, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.reject(new Error('me boom'));
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    useAuthStore.setState({ authStatus: 'authenticated', subscriptionExpired: false });

    await expect(useAuthStore.getState().checkSubscription()).resolves.toBeUndefined();

    expect(useAuthStore.getState().subscriptionExpired).toBe(false);
    expect(useAuthStore.getState().subscriptionCheckFailed).toBe(false);
    expect(mockedLog).toHaveBeenCalledWith('checkSubscription.me-failed', expect.anything());
  });

  it('subscription-status resolves VENCIDO even though support-info rejected -> blocked', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -2, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.reject(new Error('support boom'));
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    useAuthStore.setState({ authStatus: 'authenticated', subscriptionExpired: false });

    await useAuthStore.getState().checkSubscription();

    expect(useAuthStore.getState().subscriptionExpired).toBe(true);
    expect(useAuthStore.getState().authStatus).toBe('subscription-blocked');
    expect(mockedLog).toHaveBeenCalledWith('checkSubscription.support-failed', expect.anything());
  });

  it('all three sub-calls reject -> subscriptionChecked true, state unchanged, status failure logged', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));
    useAuthStore.setState({ authStatus: 'authenticated', subscriptionExpired: false, subscriptionChecked: false });

    await useAuthStore.getState().checkSubscription();

    expect(useAuthStore.getState().subscriptionChecked).toBe(true);
    expect(useAuthStore.getState().subscriptionExpired).toBe(false);
    expect(useAuthStore.getState().subscriptionCheckFailed).toBe(true);
    expect(mockedLog).toHaveBeenCalledWith('checkSubscription.status-failed', expect.anything());
  });

  it('recheck path dispatches RECHECK_RESULT (blocked flips subscription-blocked -> authenticated)', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });
    useAuthStore.setState({ authStatus: 'subscription-blocked', subscriptionExpired: true });

    await useAuthStore.getState().checkSubscription(true);

    expect(useAuthStore.getState().subscriptionExpired).toBe(false);
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
  });
});

describe('recheckSubscription — single-flight', () => {
  it('5 parallel calls collapse into exactly one /auth/subscription-status request', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 8, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });
    useAuthStore.setState({ authStatus: 'authenticated' });

    await Promise.all([
      useAuthStore.getState().recheckSubscription(),
      useAuthStore.getState().recheckSubscription(),
      useAuthStore.getState().recheckSubscription(),
      useAuthStore.getState().recheckSubscription(),
      useAuthStore.getState().recheckSubscription(),
    ]);

    const statusCalls = mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status');
    expect(statusCalls).toHaveLength(1);
  });

  it('a fresh call after the in-flight promise settles hits the endpoint again', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 8, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });
    useAuthStore.setState({ authStatus: 'authenticated' });

    await useAuthStore.getState().recheckSubscription();
    await useAuthStore.getState().recheckSubscription();

    const statusCalls = mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status');
    expect(statusCalls).toHaveLength(2);
  });
});

describe('handleSessionRevoked — coalesced graceful revocation', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('first call -> session-ending, token nulled, user kept, origin captured', () => {
    window.history.pushState({}, '', '/clientes/9?tab=historia');
    useAuthStore.setState({
      authStatus: 'authenticated',
      token: 'tok',
      user: { id: 1, name: 'Ana' } as never,
    });

    useAuthStore.getState().handleSessionRevoked();

    const s = useAuthStore.getState();
    expect(s.authStatus).toBe('session-ending');
    expect(s.token).toBeNull();
    expect(s.user).not.toBeNull();
    expect(s.sessionEndOrigin).toBe('/clientes/9?tab=historia');
  });

  it('clears auth storage on revocation', () => {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', '{"id":1}');
    useAuthStore.setState({ authStatus: 'authenticated', token: 'tok', user: { id: 1 } as never });

    useAuthStore.getState().handleSessionRevoked();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('second call while already session-ending is a no-op (coalesce)', () => {
    window.history.pushState({}, '', '/first?a=1');
    useAuthStore.setState({ authStatus: 'authenticated', token: 'tok', user: { id: 1 } as never });
    useAuthStore.getState().handleSessionRevoked();

    window.history.pushState({}, '', '/second');
    useAuthStore.getState().handleSessionRevoked();

    expect(useAuthStore.getState().sessionEndOrigin).toBe('/first?a=1');
    expect(useAuthStore.getState().authStatus).toBe('session-ending');
  });

});

describe('finalizeSessionEnd', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('clears the rest of auth state, logs out the machine, returns /login?redirect=<origin>', () => {
    window.history.pushState({}, '', '/agenda?d=1');
    useAuthStore.setState({
      authStatus: 'authenticated',
      token: 'tok',
      user: { id: 1 } as never,
      emailPendiente: 'a@b.com',
    });
    useAuthStore.getState().handleSessionRevoked();

    const to = useAuthStore.getState().finalizeSessionEnd();

    expect(to).toBe(`/login?redirect=${encodeURIComponent('/agenda?d=1')}`);
    expect(useAuthStore.getState().authStatus).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().emailPendiente).toBeNull();
    expect(useAuthStore.getState().sessionEndOrigin).toBe('');
  });

  it('returns bare /login when there is no captured origin', () => {
    useAuthStore.setState({ authStatus: 'session-ending', sessionEndOrigin: '' });
    expect(useAuthStore.getState().finalizeSessionEnd()).toBe('/login');
  });
});

describe('inicializar — boot check timeout backstop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('boot checkSubscription that never settles -> after 8s subscriptionChecked true + authenticated (fail-open)', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockReturnValue(new Promise(() => {})); // never settles

    useAuthStore.getState().inicializar();
    expect(useAuthStore.getState().authStatus).toBe('booting');
    expect(useAuthStore.getState().subscriptionChecked).toBe(false);

    await vi.advanceTimersByTimeAsync(8000);

    expect(useAuthStore.getState().subscriptionChecked).toBe(true);
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
    expect(mockedLog).toHaveBeenCalledWith('checkSubscription.boot-timeout');
  });
});
