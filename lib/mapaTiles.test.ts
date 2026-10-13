import { describe, expect, it } from 'vitest';
import { URL_TILES_LOCATIONIQ } from './mapaTiles';

// Mismo patrón (literal) que `tilesLocationIq` en next.config.ts: la PWA cachea
// los tiles que lo cumplan. Se copia porque next.config.ts no es importable acá.
const patronCacheSw = /^https:\/\/[a-z]-tiles\.locationiq\.com\/v3\//;

// Lo que hace Leaflet en TileLayer.getTileUrl: reemplaza {x} {y} {z} {s} {r} y
// las opciones propias (acá `key`).
const resolver = (plantilla: string, datos: Record<string, string | number>) =>
  plantilla.replace(/\{ *([\w_-]+) *\}/g, (_, k) => String(datos[k]));

describe('URL_TILES_LOCATIONIQ', () => {
  it('lleva {r}: en pantallas retina Leaflet pide el tile de 512 px (@2x), no el de 256 estirado', () => {
    expect(URL_TILES_LOCATIONIQ).toContain('{y}{r}.png');

    const retina = resolver(URL_TILES_LOCATIONIQ, { s: 'a', z: 16, x: 22000, y: 40000, r: '@2x', key: 'K' });
    const normal = resolver(URL_TILES_LOCATIONIQ, { s: 'a', z: 16, x: 22000, y: 40000, r: '', key: 'K' });

    expect(retina).toBe('https://a-tiles.locationiq.com/v3/streets/r/16/22000/40000@2x.png?key=K');
    expect(normal).toBe('https://a-tiles.locationiq.com/v3/streets/r/16/22000/40000.png?key=K');
  });

  it('las dos variantes siguen entrando en la caché de tiles de la PWA', () => {
    for (const r of ['', '@2x']) {
      const url = resolver(URL_TILES_LOCATIONIQ, { s: 'b', z: 13, x: 1, y: 2, r, key: 'K' });
      expect(url).toMatch(patronCacheSw);
    }
  });
});
