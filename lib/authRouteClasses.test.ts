import { describe, expect, it } from 'vitest';
import { classifyAdmin, classifyTenant } from './authRouteClasses';

const at = (pathname: string, search = '') => ({ pathname, search });

// Design D2:
// classifyTenant: public = /login (+ /login/{slug}), /forgot-password,
//   /reset-password; neutral = /legal(/*); change-pw = /cambiar-password;
//   blocked = /subscription-expired; else protected.
// classifyAdmin: public = /login (+ /login/*); else protected.

describe('classifyTenant', () => {
  it('/login -> public', () => {
    expect(classifyTenant(at('/login'))).toBe('public');
  });

  it('/login/{slug} (custom business login) -> public', () => {
    expect(classifyTenant(at('/login/nails-by-natalie'))).toBe('public');
  });

  it('/forgot-password -> public', () => {
    expect(classifyTenant(at('/forgot-password'))).toBe('public');
  });

  it('/reset-password -> public', () => {
    expect(classifyTenant(at('/reset-password', '?token=abc'))).toBe('public');
  });

  it('/legal -> neutral', () => {
    expect(classifyTenant(at('/legal'))).toBe('neutral');
  });

  it('/legal/terminos -> neutral', () => {
    expect(classifyTenant(at('/legal/terminos'))).toBe('neutral');
  });

  it('/cambiar-password -> change-pw', () => {
    expect(classifyTenant(at('/cambiar-password'))).toBe('change-pw');
  });

  it('/subscription-expired -> blocked', () => {
    expect(classifyTenant(at('/subscription-expired'))).toBe('blocked');
  });

  it('/agenda -> protected', () => {
    expect(classifyTenant(at('/agenda'))).toBe('protected');
  });

  it('/clientes/123 -> protected', () => {
    expect(classifyTenant(at('/clientes/123', '?tab=historia'))).toBe('protected');
  });

  it('/ -> protected', () => {
    expect(classifyTenant(at('/'))).toBe('protected');
  });

  it('does not confuse /loginxyz with /login', () => {
    expect(classifyTenant(at('/loginxyz'))).toBe('protected');
  });
});

describe('classifyAdmin', () => {
  it('/login -> public', () => {
    expect(classifyAdmin(at('/login'))).toBe('public');
  });

  it('/login/whatever -> public', () => {
    expect(classifyAdmin(at('/login/whatever'))).toBe('public');
  });

  it('/ -> protected', () => {
    expect(classifyAdmin(at('/'))).toBe('protected');
  });

  it('/suscripciones -> protected', () => {
    expect(classifyAdmin(at('/suscripciones'))).toBe('protected');
  });

  it('never returns neutral / change-pw / blocked', () => {
    for (const p of ['/legal', '/cambiar-password', '/subscription-expired', '/agenda']) {
      expect(['public', 'protected']).toContain(classifyAdmin(at(p)));
    }
  });
});
