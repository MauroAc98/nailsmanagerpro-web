import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function requestA(url: string, host: string): NextRequest {
  return new NextRequest(new URL(url, `http://${host}`), {
    headers: { host },
  });
}

// reservar.turnetto.com es el mismo proceso Next que app.turnetto.com (mismo
// patrón que admin.turnetto.com arriba en este archivo), separado por Host:
// una URL limpia "reservar.turnetto.com/{slug}/..." se reescribe internamente
// a "/reservar/{slug}/..." (app/reservar/[slug]/**), sin exponer ese prefijo
// al público. Los estáticos de public/ (manifest, sw.js, íconos) pasan sin
// tocar — mismo bug que costó horas en admin si se reescriben por error.
describe('middleware — reservar.turnetto.com', () => {
  it('reescribe la raíz con slug a /reservar/{slug}', () => {
    const res = middleware(requestA('/natalia-acosta', 'reservar.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://reservar.turnetto.com/reservar/natalia-acosta');
  });

  it('reescribe una subruta del flujo a /reservar/{slug}/...', () => {
    const res = middleware(requestA('/natalia-acosta/servicios', 'reservar.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://reservar.turnetto.com/reservar/natalia-acosta/servicios');
  });

  it('es idempotente: una ruta que ya trae el prefijo /reservar no se duplica', () => {
    const res = middleware(requestA('/reservar/natalia-acosta/servicios', 'reservar.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('no reescribe archivos estáticos (manifest, sw.js, íconos)', () => {
    for (const path of ['/manifest.json', '/sw.js', '/icon-192.png', '/workbox-965a1397.js', '/favicon.ico']) {
      const res = middleware(requestA(path, 'reservar.turnetto.com'));
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });

  it('deja pasar app.turnetto.com sin tocar', () => {
    const res = middleware(requestA('/natalia-acosta', 'app.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('deja pasar admin.turnetto.com sin tocar (no colisiona con el rewrite nuevo)', () => {
    const res = middleware(requestA('/', 'admin.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://admin.turnetto.com/admin');
  });
});
