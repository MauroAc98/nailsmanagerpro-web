import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/lib/logAuthEvent', () => ({ logAuthEvent: vi.fn() }));

import api from '@/lib/api';
import { renderWithProviders } from '@/test/render';
import SubscriptionExpiredPage from './page';
import { useAuthStore } from '@/store/useAuthStore';

const mockedGet = vi.mocked(api.get);
const INITIAL = useAuthStore.getState();

beforeEach(() => {
  resetNavigationMock();
  mockedGet.mockReset();
  useAuthStore.setState({
    ...INITIAL,
    authStatus: 'subscription-blocked',
    subscriptionExpired: true,
    subscriptionChecked: true,
    subscriptionCheckFailed: false,
    user: null,
    token: 'tok',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionExpiredPage — recheck', () => {
  it('recheck failure shows a distinct "no pudimos verificar" message, not "sigue vencida"', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));

    renderWithProviders(<SubscriptionExpiredPage />);
    fireEvent.click(screen.getByText('Volver a verificar'));

    expect(await screen.findByText(/no pudimos verificar/i)).toBeInTheDocument();
    expect(screen.queryByText(/sigue inactiva/i)).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authStatus).toBe('subscription-blocked');
  });

  it('recheck that is still expired shows the "sigue inactiva" copy, not the verify-failed one', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -1, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<SubscriptionExpiredPage />);
    fireEvent.click(screen.getByText('Volver a verificar'));

    expect(await screen.findByText(/sigue inactiva/i)).toBeInTheDocument();
    expect(screen.queryByText(/no pudimos verificar/i)).toBeNull();
  });

  it('recheck that comes back ACTIVO with no captured origin navigates to /agenda', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 20, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<SubscriptionExpiredPage />);
    fireEvent.click(screen.getByText('Volver a verificar'));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/agenda'));
  });

  it('recheck ACTIVO with a captured origin returns to that exact route and clears it', async () => {
    useAuthStore.setState({ subscriptionBlockedOrigin: '/clientes/5?tab=historia' });
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 20, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<SubscriptionExpiredPage />);
    fireEvent.click(screen.getByText('Volver a verificar'));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/clientes/5?tab=historia'));
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('');
  });

  it('recheck ACTIVO with an unsafe captured origin falls back to /agenda', async () => {
    useAuthStore.setState({ subscriptionBlockedOrigin: '//evil.example/phish' });
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 20, ends_at: null, is_exempt: false } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<SubscriptionExpiredPage />);
    fireEvent.click(screen.getByText('Volver a verificar'));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/agenda'));
  });
});
