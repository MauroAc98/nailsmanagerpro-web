import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { metadata as metaPro } from '@/app/(profesionales)/pro/layout';

const PUBLIC = path.join(process.cwd(), 'public');
const PRO_HOST = 'profesionales.turnetto.com';

function leerManifest() {
  return JSON.parse(readFileSync(path.join(PUBLIC, 'pro-manifest.json'), 'utf8'));
}

describe('public/pro-manifest.json', () => {
  it('declara la identidad del portal, separada del salón y del panel', () => {
    const m = leerManifest();
    expect(m.name).toBe('Turnetto Profesionales');
    expect(m.short_name).toBe('T. Pro');
    expect(m.id).toBe('/');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toBe('#ffffff');
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('referencia solo íconos propios del portal y todos existen en public/', () => {
    const { icons } = leerManifest();
    expect(icons.map((i: { src: string }) => i.src)).toEqual(['/pro-icon-192.png', '/pro-icon-512.png']);
    for (const icono of icons) {
      expect(existsSync(path.join(PUBLIC, icono.src))).toBe(true);
    }
  });

  it('no declara íconos "maskable": el logo es opaco sobre blanco y se recortaría', () => {
    const { icons } = leerManifest();
    for (const icono of icons) expect(icono.purpose ?? 'any').not.toMatch(/maskable/);
  });

  it('el layout del portal apunta a ese manifest y existe en disco', () => {
    expect(metaPro.manifest).toBe('/pro-manifest.json');
    expect(existsSync(path.join(PUBLIC, 'pro-manifest.json'))).toBe(true);
  });

  it('el layout raíz sigue con el manifest del salón', () => {
    // Se lee el fuente: importar app/layout carga next/font, que no corre en vitest.
    const fuente = readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');
    expect(fuente).toContain('manifest: "/manifest.json"');
  });
});

describe('middleware — el mapa de assets del portal apunta a archivos reales', () => {
  // Un destino inexistente 404earía dentro del precache del service worker
  // (una sola URL caída aborta la instalación completa).
  it.each(['/manifest.json', '/icon-192.png', '/icon-512.png'])('%s -> un archivo que existe en public/', (ruta) => {
    const res = middleware(new NextRequest(`http://${PRO_HOST}${ruta}`, { headers: { host: PRO_HOST } }));
    const destino = new URL(res.headers.get('x-middleware-rewrite') ?? '').pathname;
    expect(destino).toMatch(/^\/pro-/);
    expect(existsSync(path.join(PUBLIC, destino))).toBe(true);
  });
});
