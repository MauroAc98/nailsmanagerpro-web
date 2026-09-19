import { afterEach, describe, expect, it, vi } from 'vitest';
import { reservaOnlineHabilitada } from './flag';

describe('reservaOnlineHabilitada', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('esta apagado cuando la variable no existe', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', '');
    expect(reservaOnlineHabilitada()).toBe(false);
  });

  it("solo el valor exacto 'true' lo enciende", () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    expect(reservaOnlineHabilitada()).toBe(true);
  });

  it.each(['false', '1', 'TRUE', 'yes', ' true'])('%s no lo enciende', (valor) => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', valor);
    expect(reservaOnlineHabilitada()).toBe(false);
  });
});
