import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_HOST,
  ADMIN_PAGES,
  APP_HOST,
  PRO_HOST,
  RESERVAR_HOST,
  esHostInterno,
  esRutaUso,
  normalizarHost,
  tienePrefijoPro,
} from './hosts';

describe('hosts — constantes', () => {
  it('son los cuatro dominios de producción', () => {
    expect(ADMIN_HOST).toBe('admin.turnetto.com');
    expect(APP_HOST).toBe('app.turnetto.com');
    expect(RESERVAR_HOST).toBe('reservar.turnetto.com');
    expect(PRO_HOST).toBe('profesionales.turnetto.com');
  });
});

describe('tienePrefijoPro', () => {
  it.each([
    ['/pro', true],
    ['/pro/', true],
    ['/pro/login', true],
    ['/pro/agenda/123', true],
    ['/prox', false],
    ['/professionals', false],
    ['/pro-manifest.json', false],
    ['/', false],
    ['/agenda/pro', false],
    ['', false],
  ])('%j -> %s', (pathname, esperado) => {
    expect(tienePrefijoPro(pathname)).toBe(esperado);
  });
});

describe('normalizarHost', () => {
  it.each([
    ['admin.turnetto.com', 'admin.turnetto.com'],
    ['ADMIN.TURNETTO.COM', 'admin.turnetto.com'],
    ['admin.turnetto.com:443', 'admin.turnetto.com'],
    ['Admin.Turnetto.com:3000', 'admin.turnetto.com'],
    ['localhost:3000', 'localhost'],
    ['127.0.0.1:3000', '127.0.0.1'],
    ['[::1]:3000', '[::1]'],
    ['[::1]', '[::1]'],
    ['  app.turnetto.com  ', 'app.turnetto.com'],
    ['app.turnetto.com.', 'app.turnetto.com'],
    ['', ''],
  ])('%j -> %j', (crudo, esperado) => {
    expect(normalizarHost(crudo)).toBe(esperado);
  });

  it('null/undefined dan cadena vacía', () => {
    expect(normalizarHost(null)).toBe('');
    expect(normalizarHost(undefined)).toBe('');
  });
});

describe('esHostInterno', () => {
  it.each([
    ['localhost', true],
    ['localhost:3000', true],
    ['LOCALHOST:3000', true],
    ['127.0.0.1', true],
    ['127.0.0.1:3000', true],
    ['[::1]:3000', true],
    ['turnetto.com', false],
    ['www.turnetto.com', false],
    ['203.0.113.7', false],
    ['localhost.evil.com', false],
    ['admin.turnetto.com', false],
    ['', false],
  ])('%j -> %s', (host, esperado) => {
    expect(esHostInterno(host)).toBe(esperado);
  });
});

describe('esRutaUso', () => {
  it('acepta las 3 formas reales', () => {
    for (const p of ['/uso', '/uso/42', '/uso/42/dia']) expect(esRutaUso(p)).toBe(true);
  });
  it('rechaza ids no numéricos y sub-rutas desconocidas', () => {
    for (const p of ['/uso/abc', '/uso/42/otracosa', '/usoalgo', '/uso/']) {
      expect(esRutaUso(p)).toBe(false);
    }
  });
});

// Si se agrega una página bajo app/(admin)/admin/ y no se suma a ADMIN_PAGES
// (o a esRutaUso), el middleware la 404earía en admin.turnetto.com en
// silencio. Este test hace que eso falle en CI.
function rutasDePaginasAdmin(): string[] {
  const raiz = join(process.cwd(), 'app', '(admin)', 'admin');
  const rutas: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const completo = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completo);
      else if (entrada.name === 'page.tsx') {
        const segmentos = relative(raiz, dir)
          .split(sep)
          .filter((s) => s !== '' && !/^\(.*\)$/.test(s))
          // Segmento dinámico [userId] -> id numérico de ejemplo.
          .map((s) => (/^\[.+\]$/.test(s) ? '1' : s));
        rutas.push('/' + segmentos.join('/'));
      }
    }
  };
  recorrer(raiz);
  return rutas;
}

describe('ADMIN_PAGES vs. app/(admin)/admin/**', () => {
  const rutas = rutasDePaginasAdmin();

  it('encuentra páginas reales (sanity del recorrido)', () => {
    expect(rutas.length).toBeGreaterThan(3);
    expect(rutas).toContain('/');
  });

  it('toda page.tsx del panel está cubierta por ADMIN_PAGES o esRutaUso', () => {
    const sinCubrir = rutas.filter((r) => !ADMIN_PAGES.has(r) && !esRutaUso(r));
    expect(sinCubrir).toEqual([]);
  });

  it('toda entrada de ADMIN_PAGES tiene su page.tsx', () => {
    const sinPagina = [...ADMIN_PAGES].filter((r) => !rutas.includes(r));
    expect(sinPagina).toEqual([]);
  });

  it('las 3 formas de /uso existen como página', () => {
    for (const r of ['/uso', '/uso/1', '/uso/1/dia']) expect(rutas).toContain(r);
  });
});
