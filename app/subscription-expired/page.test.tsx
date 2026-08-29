import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/lib/logAuthEvent', () => ({ logAuthEvent: vi.fn() }));

import api from '@/lib/api';
import Providers from '@/app/providers';
import SubscriptionExpiredPage from './page';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

const mockedGet = vi.mocked(api.get);
const INITIAL = useAuthStore.getState();

// Render the page INSIDE the real `Providers` so the auth guard effect runs and
// the guard <-> page composition is exercised (verify CRITICAL-2: a standalone
// page render hid the fact that the guard overrode the page's navigation).
function renderInGuard() {
  return render(
    <Providers>
      <SubscriptionExpiredPage />
    </Providers>,
  );
}

function mockStatus(status: string) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/auth/subscription-status') {
      return Promise.resolve({ data: { status, days_left: 20, ends_at: null, is_exempt: false } });
    }
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => {
  resetNavigationMock();
  // Simulate the navigation actually committing so the guard stops re-resolving
  // against the stale `/subscription-expired` pathname (next's real router does
  // this for us; the test mock does not).
  routerMock.push.mockImplementation((url: string) => {
    const q = url.indexOf('?');
    if (q === -1) setMockLocation(url);
    else setMockLocation(url.slice(0, q), url.slice(q));
  });
  mockedGet.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({
    ...INITIAL,
    // `Providers` calls `inicializar()` on mount — no-op it so the boot flow
    // does not race the button-triggered recheck this suite is about.
    inicializar: vi.fn(),
    authStatus: 'subscription-blocked',
    subscriptionExpired: true,
    subscriptionChecked: true,
    subscriptionCheckFailed: false,
    subscriptionBlockedOrigin: '',
    user: null,
    token: 'tok',
  });
  useLocaleStore.setState({ mensajesListos: true });
  setMockLocation('/subscription-expired');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionExpiredPage — recheck messages', () => {
  it('recheck failure shows a distinct "no pudimos verificar" message, not "sigue vencida"', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    expect(await screen.findByText(/no pudimos verificar/i)).toBeInTheDocument();
    expect(screen.queryByText(/sigue inactiva/i)).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authStatus).toBe('subscription-blocked');
  });

  it('recheck still expired shows the "sigue inactiva" copy, not the verify-failed one', async () => {
    mockStatus('VENCIDO');

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    expect(await screen.findByText(/sigue inactiva/i)).toBeInTheDocument();
    expect(screen.queryByText(/no pudimos verificar/i)).toBeNull();
  });
});

describe('SubscriptionExpiredPage — post-renew navigation is owned by the guard (verify CRITICAL-2)', () => {
  it('blocked from a deep route -> recheck ACTIVO -> the ONLY navigation is back to that deep route', async () => {
    useAuthStore.setState({ subscriptionBlockedOrigin: '/clientes/5?tab=historia' });
    mockStatus('ACTIVO');

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith('/clientes/5?tab=historia'),
    );
    // The guard is the single navigation owner: the page no longer calls
    // router.replace, and the guard never falls back to /agenda here.
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
    // Origin consumed — a later unrelated block must not reuse it.
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('');
  });

  it('deep origin that does NOT commit synchronously (dynamic route RSC fetch) -> still no /agenda bounce', async () => {
    // Real Next does not commit a dynamic route's pathname in the same tick.
    // Reproduce that: `push` records the call but does NOT update the mock
    // location, so every follow-up render still sees `/subscription-expired`.
    // The captured origin must stay populated so `home` keeps resolving to the
    // deep route — never falling back to `/agenda` (verify CRITICAL-2).
    routerMock.push.mockImplementation(() => {});
    useAuthStore.setState({ subscriptionBlockedOrigin: '/clientes/5?tab=historia' });
    mockStatus('ACTIVO');

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith('/clientes/5?tab=historia'),
    );
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
    // Origin not cleared yet — the navigation has not committed. That is
    // correct: it is what holds `home` on the deep route through the limbo.
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('/clientes/5?tab=historia');
  });

  it('no captured origin -> recheck ACTIVO -> guard navigates to /agenda', async () => {
    mockStatus('ACTIVO');

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/agenda'));
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('unsafe captured origin -> recheck ACTIVO -> guard falls back to /agenda', async () => {
    useAuthStore.setState({ subscriptionBlockedOrigin: '//evil.example/phish' });
    mockStatus('ACTIVO');

    renderInGuard();
    fireEvent.click(await screen.findByText('Volver a verificar'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/agenda'));
    expect(routerMock.push).not.toHaveBeenCalledWith('//evil.example/phish');
  });
});
