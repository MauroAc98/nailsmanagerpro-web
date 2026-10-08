import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APPLE_SPLASH_SCREENS, enlacesSplashIos } from './appleSplash';

const enPublic = (href: string) => existsSync(join(process.cwd(), 'public', href));

describe('enlacesSplashIos', () => {
  const enlaces = enlacesSplashIos();

  it('hay un enlace claro y uno oscuro por cada tamaño de pantalla', () => {
    expect(enlaces).toHaveLength(APPLE_SPLASH_SCREENS.length * 2);
  });

  it('el claro y el oscuro se distinguen por prefers-color-scheme, sin ambigüedad', () => {
    for (const { size, media } of APPLE_SPLASH_SCREENS) {
      const claro = enlaces.find(e => e.href === `/splash/apple-splash-${size}.png`);
      const oscuro = enlaces.find(e => e.href === `/splash/apple-splash-dark-${size}.png`);

      expect(claro?.media).toBe(`${media} and (prefers-color-scheme: light)`);
      expect(oscuro?.media).toBe(`${media} and (prefers-color-scheme: dark)`);
    }
  });

  it('cada enlace apunta a una imagen que existe en public/', () => {
    for (const { href } of enlaces) {
      expect(enPublic(href), href).toBe(true);
    }
  });

  it('no repite ni tamaños ni enlaces', () => {
    expect(new Set(APPLE_SPLASH_SCREENS.map(s => s.size)).size).toBe(APPLE_SPLASH_SCREENS.length);
    expect(new Set(enlaces.map(e => e.href)).size).toBe(enlaces.length);
  });
});
