import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { ContactanosReservaOnline } from './ContactanosReservaOnline';

const useAuthMock = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

describe('ContactanosReservaOnline', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    vi.restoreAllMocks();
  });

  it('opens WhatsApp support with a prefilled message', async () => {
    useAuthMock.mockReturnValue({ supportInfo: { whatsapp: '+54 9 376 512-3456' } });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { default: userEvent } = await import('@testing-library/user-event');

    renderWithProviders(<ContactanosReservaOnline />);
    await userEvent.click(screen.getByRole('button', { name: /contactanos/i }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/5493765123456\?text=/);
  });

  it('hides the button when there is no support number', () => {
    useAuthMock.mockReturnValue({ supportInfo: null });
    renderWithProviders(<ContactanosReservaOnline />);

    expect(screen.queryByRole('button', { name: /contactanos/i })).toBeNull();
    expect(screen.getByText(/reserva online/i)).toBeTruthy();
  });
});
