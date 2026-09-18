import { describe, expect, it } from 'vitest';
import { urlMapaEstatico } from './mapaEstatico';

describe('urlMapaEstatico', () => {
  it('arma la URL del mapa estático de LocationIQ centrada en el pin', () => {
    const url = urlMapaEstatico(-27.4692, -58.8306, 'abc123');
    expect(url).not.toBeNull();
    const u = new URL(url as string);
    expect(u.origin + u.pathname).toBe('https://maps.locationiq.com/v3/staticmap');
    expect(u.searchParams.get('key')).toBe('abc123');
    expect(u.searchParams.get('center')).toBe('-27.4692,-58.8306');
    expect(u.searchParams.get('markers')).toContain('-27.4692,-58.8306');
  });

  it('devuelve null si no hay key configurada', () => {
    expect(urlMapaEstatico(-27.4692, -58.8306, undefined)).toBeNull();
    expect(urlMapaEstatico(-27.4692, -58.8306, '')).toBeNull();
  });
});
