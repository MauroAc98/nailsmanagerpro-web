import { describe, expect, it } from 'vitest';
import { PRO_STORAGE_KEYS, esClaveSesionPro } from './storageKeys';

describe('PRO_STORAGE_KEYS', () => {
  it('usa claves propias del portal, distintas de las del tenant y del admin', () => {
    expect(PRO_STORAGE_KEYS).toEqual({
      token: 'pro_token',
      tipo: 'pro_token_tipo',
      expiresAt: 'pro_token_expires_at',
      ultimoVinculo: 'pro_ultimo_vinculo',
    });
    const valores = Object.values(PRO_STORAGE_KEYS);
    expect(valores).not.toContain('auth_token');
    expect(valores).not.toContain('admin_token');
  });
});

describe('esClaveSesionPro', () => {
  it.each([
    ['pro_token', true],
    ['pro_token_tipo', true],
    ['pro_token_expires_at', true],
    ['pro_ultimo_vinculo', false],
    ['auth_token', false],
    ['admin_token', false],
    ['', false],
    [null, false],
  ])('%j -> %j', (clave, esperado) => {
    expect(esClaveSesionPro(clave)).toBe(esperado);
  });
});
