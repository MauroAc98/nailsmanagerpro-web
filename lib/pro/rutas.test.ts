import { describe, expect, it } from 'vitest';
import { conPrefijoPro, rutaLimpiaPro } from './rutas';

describe('rutaLimpiaPro', () => {
  it.each([
    ['/pro', '/'],
    ['/pro/', '/'],
    ['/pro/agenda', '/agenda'],
    ['/pro/turnos/12', '/turnos/12'],
    ['/agenda', '/agenda'],
    ['/', '/'],
    ['/prox', '/prox'],
    ['/professionals', '/professionals'],
  ])('%j -> %j', (pathname, esperado) => {
    expect(rutaLimpiaPro(pathname)).toBe(esperado);
  });
});

describe('conPrefijoPro', () => {
  it('agrega /pro solo cuando el pathname actual lo trae (localhost / dev)', () => {
    expect(conPrefijoPro('/agenda', '/pro/login')).toBe('/pro/agenda');
    expect(conPrefijoPro('/login', '/pro')).toBe('/pro/login');
  });

  it('no agrega nada en el host del portal (ruta limpia)', () => {
    expect(conPrefijoPro('/agenda', '/login')).toBe('/agenda');
    expect(conPrefijoPro('/', '/agenda')).toBe('/');
  });

  it('la raíz con prefijo es /pro, no /pro/', () => {
    expect(conPrefijoPro('/', '/pro/login')).toBe('/pro');
  });
});
