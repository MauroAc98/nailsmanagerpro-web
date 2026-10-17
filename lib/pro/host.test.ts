import { describe, expect, it } from 'vitest';
import { esPortalProfesionales } from './host';

describe('esPortalProfesionales', () => {
  it('es el portal por el host, con la ruta limpia', () => {
    expect(esPortalProfesionales('profesionales.turnetto.com', '/agenda')).toBe(true);
    expect(esPortalProfesionales('PROFESIONALES.TURNETTO.COM:443', '/')).toBe(true);
    expect(esPortalProfesionales('profesionales.turnetto.com.', '/login')).toBe(true);
  });

  it('es el portal por el prefijo /pro (localhost / dev)', () => {
    expect(esPortalProfesionales('localhost', '/pro/login')).toBe(true);
    expect(esPortalProfesionales('localhost', '/pro')).toBe(true);
  });

  it('sin hostname (servidor) decide solo el prefijo', () => {
    expect(esPortalProfesionales(null, '/pro/login')).toBe(true);
    expect(esPortalProfesionales(null, '/agenda')).toBe(false);
  });

  it('otros hosts con ruta sin prefijo no son el portal', () => {
    expect(esPortalProfesionales('app.turnetto.com', '/agenda')).toBe(false);
    expect(esPortalProfesionales('admin.turnetto.com', '/login')).toBe(false);
    expect(esPortalProfesionales('reservar.turnetto.com', '/natalia')).toBe(false);
  });

  it('un host parecido no es el portal', () => {
    expect(esPortalProfesionales('profesionales.turnetto.com.evil.com', '/login')).toBe(false);
  });
});
