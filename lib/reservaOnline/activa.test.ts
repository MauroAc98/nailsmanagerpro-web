import { afterEach, describe, expect, it, vi } from 'vitest';
import { reservaOnlineActivaParaNegocio } from './activa';

describe('reservaOnlineActivaParaNegocio', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is active only with the global flag on and the business add-on active', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    expect(reservaOnlineActivaParaNegocio({ reserva_online_activa: true })).toBe(true);
  });

  it('is inactive when the business does not have the add-on', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    expect(reservaOnlineActivaParaNegocio({ reserva_online_activa: false })).toBe(false);
  });

  it('is inactive when the user is missing or the backend did not send the field', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    expect(reservaOnlineActivaParaNegocio(null)).toBe(false);
    expect(reservaOnlineActivaParaNegocio(undefined)).toBe(false);
    expect(reservaOnlineActivaParaNegocio({})).toBe(false);
  });

  it('the global flag acts as a kill switch even with the add-on active', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', '');
    expect(reservaOnlineActivaParaNegocio({ reserva_online_activa: true })).toBe(false);
  });
});
