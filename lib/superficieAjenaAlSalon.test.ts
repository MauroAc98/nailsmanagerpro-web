import { describe, expect, it } from 'vitest';
import { esSuperficieAjenaAlSalon } from './superficieAjenaAlSalon';

describe('esSuperficieAjenaAlSalon', () => {
  it('el panel de admin es ajeno al salón, por host o por prefijo', () => {
    expect(esSuperficieAjenaAlSalon('admin.turnetto.com', '/suscripciones')).toBe(true);
    expect(esSuperficieAjenaAlSalon('app.turnetto.com', '/admin/login')).toBe(true);
    expect(esSuperficieAjenaAlSalon(null, '/admin')).toBe(true);
  });

  it('profesionales.turnetto.com es ajeno al salón en cualquier ruta (URLs limpias, sin /pro)', () => {
    expect(esSuperficieAjenaAlSalon('profesionales.turnetto.com', '/')).toBe(true);
    expect(esSuperficieAjenaAlSalon('profesionales.turnetto.com', '/agenda')).toBe(true);
    expect(esSuperficieAjenaAlSalon('PROFESIONALES.TURNETTO.COM:443', '/login')).toBe(true);
  });

  it('sin host (renderizado en servidor) decide el prefijo /pro', () => {
    expect(esSuperficieAjenaAlSalon(null, '/pro/login')).toBe(true);
    expect(esSuperficieAjenaAlSalon(null, '/pro')).toBe(true);
    expect(esSuperficieAjenaAlSalon(null, '/agenda')).toBe(false);
  });

  it('en un host interno (localhost, dev) el prefijo /pro es el portal', () => {
    expect(esSuperficieAjenaAlSalon('localhost', '/pro/login')).toBe(true);
    expect(esSuperficieAjenaAlSalon('localhost:3000', '/pro/agenda')).toBe(true);
    expect(esSuperficieAjenaAlSalon('127.0.0.1', '/pro')).toBe(true);
    expect(esSuperficieAjenaAlSalon('[::1]:3000', '/pro/login')).toBe(true);
  });

  it('en app.turnetto.com u otro host externo, /pro/... NO se exime (S6: el middleware ya lo 404ea)', () => {
    expect(esSuperficieAjenaAlSalon('app.turnetto.com', '/pro/x')).toBe(false);
    expect(esSuperficieAjenaAlSalon('app.turnetto.com', '/pro')).toBe(false);
    expect(esSuperficieAjenaAlSalon('evil.example.com', '/pro/login')).toBe(false);
    expect(esSuperficieAjenaAlSalon('', '/pro/login')).toBe(false);
  });

  it('un host que solo parece el del portal no se exime', () => {
    expect(esSuperficieAjenaAlSalon('profesionales.turnetto.com.evil.com', '/agenda')).toBe(false);
  });

  it('reservar.turnetto.com NO entra en esta bandera (su arranque queda como estaba)', () => {
    expect(esSuperficieAjenaAlSalon('reservar.turnetto.com', '/natalia-acosta')).toBe(false);
  });

  it('las pantallas del salón no son ajenas', () => {
    expect(esSuperficieAjenaAlSalon('app.turnetto.com', '/agenda')).toBe(false);
    expect(esSuperficieAjenaAlSalon('localhost', '/login')).toBe(false);
    expect(esSuperficieAjenaAlSalon('localhost', '/prox')).toBe(false);
    expect(esSuperficieAjenaAlSalon(null, '/professionals')).toBe(false);
  });
});
