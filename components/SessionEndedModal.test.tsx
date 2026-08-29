import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { renderWithProviders } from '@/test/render';
import { SessionEndedModal } from './SessionEndedModal';
import { useAuthStore } from '@/store/useAuthStore';

const INITIAL = useAuthStore.getState();

function ModalUnderScreen() {
  return (
    <>
      <div>UNDERLYING SCREEN</div>
      <SessionEndedModal />
    </>
  );
}

beforeEach(() => {
  resetNavigationMock();
  window.history.pushState({}, '', '/agenda');
  useAuthStore.setState({
    ...INITIAL,
    authStatus: 'authenticated',
    token: 'tok',
    user: { id: 1, name: 'Ana' } as never,
    sessionEndOrigin: '',
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('SessionEndedModal', () => {
  it('renders nothing while the session is not ending', () => {
    renderWithProviders(<ModalUnderScreen />);
    expect(screen.queryByText('Tu sesión se cerró')).toBeNull();
    expect(screen.getByText('UNDERLYING SCREEN')).toBeInTheDocument();
  });

  it('shows the modal over the still-mounted screen once the session is ending', () => {
    renderWithProviders(<ModalUnderScreen />);
    act(() => {
      useAuthStore.getState().handleSessionRevoked();
    });

    expect(screen.getByText('Tu sesión se cerró')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeInTheDocument();
    // the screen underneath is NOT blanked
    expect(screen.getByText('UNDERLYING SCREEN')).toBeInTheDocument();
  });

  it('auto-navigates via router.replace after the 3s countdown', async () => {
    vi.useFakeTimers();
    renderWithProviders(<ModalUnderScreen />);
    act(() => {
      useAuthStore.getState().handleSessionRevoked();
    });

    expect(routerMock.replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/login/));
    expect(useAuthStore.getState().authStatus).toBe('unauthenticated');
  });

  it('"Entendido" navigates immediately without waiting for the timer', () => {
    renderWithProviders(<ModalUnderScreen />);
    act(() => {
      useAuthStore.getState().handleSessionRevoked();
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    });

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/login/));
  });

  it('clears the timer on unmount — no navigation fires afterwards', async () => {
    vi.useFakeTimers();
    const { unmount } = renderWithProviders(<ModalUnderScreen />);
    act(() => {
      useAuthStore.getState().handleSessionRevoked();
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('preserves the origin route in the redirect target', () => {
    window.history.pushState({}, '', '/clientes/7?tab=historia');
    renderWithProviders(<ModalUnderScreen />);
    act(() => {
      useAuthStore.getState().handleSessionRevoked();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    });

    expect(routerMock.replace).toHaveBeenCalledWith(
      `/login?redirect=${encodeURIComponent('/clientes/7?tab=historia')}`,
    );
  });
});
