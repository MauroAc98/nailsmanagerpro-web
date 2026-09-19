import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_TOKEN_KEY, getDeviceToken, resetDeviceTokenParaTests } from './deviceToken';

// Token opaco de dispositivo (decision A4 del diseno de la slice 3): el
// backend solo lo hashea, nunca lo interpreta. Formato exigido por
// ExigeDeviceToken: [A-Za-z0-9_-]{32,128}.
const FORMATO = /^[A-Za-z0-9_-]{32,128}$/;

function memoria(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('getDeviceToken', () => {
  beforeEach(() => resetDeviceTokenParaTests());

  it('genera un token con el formato que exige el backend', () => {
    const token = getDeviceToken(memoria());
    expect(token).toMatch(FORMATO);
  });

  it('se genera una sola vez y se persiste bajo la clave conocida', () => {
    const storage = memoria();
    const token = getDeviceToken(storage);
    expect(storage.getItem(DEVICE_TOKEN_KEY)).toBe(token);
    expect(getDeviceToken(storage)).toBe(token);
  });

  it('con storage inyectable, otra instancia con el mismo storage ve el mismo token', () => {
    const storage = memoria();
    const a = getDeviceToken(storage);
    const b = getDeviceToken(storage);
    expect(a).toBe(b);
  });

  it('dos storages distintos generan tokens distintos', () => {
    const a = getDeviceToken(memoria());
    const b = getDeviceToken(memoria());
    expect(a).not.toBe(b);
  });

  it('si el storage esta bloqueado (navegacion privada) cae a un fallback en memoria sin tirar', () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    let token = '';
    expect(() => {
      token = getDeviceToken(bloqueado);
    }).not.toThrow();
    expect(token).toMatch(FORMATO);
    // el fallback en memoria persiste entre llamadas mientras el storage siga bloqueado
    expect(getDeviceToken(bloqueado)).toBe(token);
  });
});
