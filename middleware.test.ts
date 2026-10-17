import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { config, middleware } from './middleware';

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

// /uso es la primera página del panel admin con un segmento dinámico (el id
// del negocio) — ADMIN_PAGES es un Set de strings literales, no puede
// listar "cualquier id", así que esRutaUso() la matchea aparte con una
// regex acotada a las 3 formas reales.
describe('middleware — admin.turnetto.com /uso (segmento dinámico)', () => {
  it('reescribe la lista /uso', () => {
    const res = middleware(requestA('/uso', 'admin.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://admin.turnetto.com/admin/uso');
  });

  it('reescribe el detalle de un negocio /uso/:id', () => {
    const res = middleware(requestA('/uso/42', 'admin.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://admin.turnetto.com/admin/uso/42');
  });

  it('reescribe el detalle por hora /uso/:id/dia', () => {
    const res = middleware(requestA('/uso/42/dia', 'admin.turnetto.com'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://admin.turnetto.com/admin/uso/42/dia');
  });

  it('no matchea un id no numérico ni una sub-ruta desconocida', () => {
    for (const path of ['/uso/abc', '/uso/42/otracosa', '/usoalgo']) {
      const res = middleware(requestA(path, 'admin.turnetto.com'));
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Matriz de hosts (hardening del panel admin). Mismo proceso Next para
// admin/app/reservar: el host decide qué se sirve. Ver comentarios largos en
// middleware.ts — acá se fija el contrato.
// ---------------------------------------------------------------------------
type Esperado =
  | { tipo: 'rewrite'; destino: string }
  | { tipo: 'pasa' }
  | { tipo: '404' };

function clasificar(path: string, host: string): Esperado['tipo'] | { rewrite: string } {
  const res = middleware(requestA(path, host));
  const rewrite = res.headers.get('x-middleware-rewrite');
  if (rewrite) return { rewrite };
  if (res.status === 404) return '404';
  return 'pasa';
}

function verificar(path: string, host: string, esperado: Esperado) {
  const real = clasificar(path, host);
  if (esperado.tipo === 'rewrite') expect(real).toEqual({ rewrite: esperado.destino });
  else expect(real).toBe(esperado.tipo);
}

describe('middleware — admin.turnetto.com, allowlist cerrada', () => {
  const H = 'admin.turnetto.com';
  const casos: Array<[string, string, Esperado]> = [
    // páginas del panel (URLs limpias)
    ['página raíz', '/', { tipo: 'rewrite', destino: `http://${H}/admin` }],
    ['login', '/login', { tipo: 'rewrite', destino: `http://${H}/admin/login` }],
    ['negocios/nuevo', '/negocios/nuevo', { tipo: 'rewrite', destino: `http://${H}/admin/negocios/nuevo` }],
    ['suscripciones', '/suscripciones', { tipo: 'rewrite', destino: `http://${H}/admin/suscripciones` }],
    ['configuracion', '/configuracion', { tipo: 'rewrite', destino: `http://${H}/admin/configuracion` }],
    ['mercadopago', '/mercadopago', { tipo: 'rewrite', destino: `http://${H}/admin/mercadopago` }],
    // assets propios de admin
    ['manifest', '/manifest.json', { tipo: 'rewrite', destino: `http://${H}/admin-manifest.json` }],
    ['icon-192', '/icon-192.png', { tipo: 'rewrite', destino: `http://${H}/admin-icon-192.png` }],
    ['icon-512', '/icon-512.png', { tipo: 'rewrite', destino: `http://${H}/admin-icon-512.png` }],
    // estáticos reales de public/: pasan sin tocar
    ['sw.js', '/sw.js', { tipo: 'pasa' }],
    ['workbox', '/workbox-965a1397.js', { tipo: 'pasa' }],
    ['splash', '/splash/apple-splash-1170-2532.png', { tipo: 'pasa' }],
    ['favicon', '/favicon.ico', { tipo: 'pasa' }],
    ['admin-manifest por su nombre real', '/admin-manifest.json', { tipo: 'pasa' }],
    ['admin-icon por su nombre real', '/admin-icon-192.png', { tipo: 'pasa' }],
    // prefijo viejo /admin*: 404 (incluso con punto)
    ['/admin', '/admin', { tipo: '404' }],
    ['/admin/', '/admin/', { tipo: '404' }],
    ['/admin/login', '/admin/login', { tipo: '404' }],
    ['/admin/uso/1', '/admin/uso/1', { tipo: '404' }],
    ['/admin/x.png', '/admin/x.png', { tipo: '404' }],
    // páginas del tenant: 404 (mismo origen que guarda el token del admin)
    ['tenant /clientes', '/clientes', { tipo: '404' }],
    ['tenant /agenda', '/agenda', { tipo: '404' }],
    ['tenant /login/foo', '/login/foo', { tipo: '404' }],
    ['reserva /reservar/foo', '/reservar/foo', { tipo: '404' }],
    ['reserva /reservar', '/reservar', { tipo: '404' }],
    ['cualquier slug', '/natalia-acosta', { tipo: '404' }],
    // /uso con regex acotada: lo que no matchea ahora es 404, no pass
    ['/uso/abc', '/uso/abc', { tipo: '404' }],
    ['/uso/42/otracosa', '/uso/42/otracosa', { tipo: '404' }],
    ['/usoalgo', '/usoalgo', { tipo: '404' }],
  ];

  it.each(casos)('%s (%s)', (_nombre, path, esperado) => {
    verificar(path, H, esperado);
  });

  it('una página del tenant en el host admin responde status 404', () => {
    expect(middleware(requestA('/clientes', H)).status).toBe(404);
  });
});

describe('middleware — normalización del host', () => {
  const variantes = ['ADMIN.TURNETTO.COM', 'admin.turnetto.com:443', 'Admin.Turnetto.com:3000', 'admin.turnetto.com.'];

  it.each(variantes)('admin con host %s se comporta como admin', (host) => {
    const res = middleware(requestA('/login', host));
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/admin\/login$/);
    verificar('/clientes', host, { tipo: '404' });
    verificar('/admin/login', host, { tipo: '404' });
    verificar('/sw.js', host, { tipo: 'pasa' });
  });

  it.each(['APP.TURNETTO.COM', 'app.turnetto.com:443'])('app con host %s 404ea /admin', (host) => {
    verificar('/admin', host, { tipo: '404' });
    verificar('/admin/login', host, { tipo: '404' });
    verificar('/clientes', host, { tipo: 'pasa' });
  });

  it.each(['RESERVAR.TURNETTO.COM', 'reservar.turnetto.com:443'])('reservar con host %s reescribe', (host) => {
    const res = middleware(requestA('/natalia-acosta', host));
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/reservar\/natalia-acosta$/);
  });
});

describe('middleware — app.turnetto.com', () => {
  it.each(['/admin', '/admin/', '/admin/login', '/admin/negocios/nuevo'])('%s -> 404', (path) => {
    verificar(path, 'app.turnetto.com', { tipo: '404' });
  });

  it.each(['/clientes', '/login', '/administracion', '/admin-manifest.json'])('%s pasa', (path) => {
    verificar(path, 'app.turnetto.com', { tipo: 'pasa' });
  });
});

describe('middleware — host desconocido (apex, www, IP pelada, otro dominio)', () => {
  const hosts = ['turnetto.com', 'www.turnetto.com', 'WWW.Turnetto.com:443', '203.0.113.7', '203.0.113.7:443', 'otro.example.org'];

  describe.each(hosts)('host %j', (host) => {
    it.each(['/admin', '/admin/', '/admin/login', '/admin/uso/1/dia'])('%s -> 404', (path) => {
      verificar(path, host, { tipo: '404' });
    });

    it.each(['/', '/clientes', '/login/foo', '/administracion', '/admin-manifest.json', '/sw.js'])(
      '%s sigue pasando como hoy',
      (path) => {
        verificar(path, host, { tipo: 'pasa' });
      },
    );
  });

  it('sin header Host: /admin* 404, el resto pasa', () => {
    const sinHost = (path: string) => middleware(new NextRequest(new URL(path, 'http://x')));
    expect(sinHost('/admin/login').status).toBe(404);
    expect(sinHost('/clientes').headers.get('x-middleware-rewrite')).toBeNull();
    expect(sinHost('/clientes').status).toBe(200);
  });
});

// El fetch interno de Next que resuelve un rewrite llega con Host:
// localhost:3000 (bug real en prod: bloquearlo tumbó admin.turnetto.com/login)
// y `npm run dev` también usa localhost. Ese host NO se toca.
describe('middleware — host interno/dev (localhost, 127.0.0.1, cualquier puerto)', () => {
  const hosts = ['localhost:3000', 'localhost', 'LOCALHOST:3000', '127.0.0.1:3000', '127.0.0.1', 'localhost:4000'];

  describe.each(hosts)('host %j', (host) => {
    it.each(['/admin', '/admin/login', '/admin/uso/1', '/admin-icon-192.png'])('%s pasa sin bloquear ni reescribir', (path) => {
      verificar(path, host, { tipo: 'pasa' });
    });

    it.each(['/clientes', '/login', '/reservar/foo', '/sw.js', '/manifest.json'])('%s pasa sin reescribir', (path) => {
      verificar(path, host, { tipo: 'pasa' });
    });
  });
});

// ---------------------------------------------------------------------------
// profesionales.turnetto.com — portal de profesionales. Mismo proceso/build que
// los demás; TODO el portal vive bajo el prefijo /pro (app/(profesionales)/pro),
// así que el rewrite es "agregar /pro adelante" (estilo reservar). /pro* no
// existe en ningún otro host externo.
// ---------------------------------------------------------------------------
describe('middleware — profesionales.turnetto.com, rewrite al prefijo /pro', () => {
  const H = 'profesionales.turnetto.com';

  it.each([
    ['raíz', '/', `http://${H}/pro`],
    ['login', '/login', `http://${H}/pro/login`],
    ['agenda con id', '/agenda/123', `http://${H}/pro/agenda/123`],
    ['turno', '/turnos/12', `http://${H}/pro/turnos/12`],
    ['conserva la query', '/agenda/123?x=1', `http://${H}/pro/agenda/123?x=1`],
    ['una ruta del tenant nunca se sirve tal cual', '/configuracion', `http://${H}/pro/configuracion`],
  ])('%s (%s)', (_nombre, path, destino) => {
    verificar(path, H, { tipo: 'rewrite', destino });
  });

  it('es idempotente: una ruta que ya trae /pro no se duplica', () => {
    verificar('/pro/login', H, { tipo: 'pasa' });
    verificar('/pro', H, { tipo: 'pasa' });
  });

  it('fuerza http: aunque el request llegue por https', () => {
    const req = new NextRequest(new URL('https://profesionales.turnetto.com/login'), { headers: { host: H } });
    expect(middleware(req).headers.get('x-middleware-rewrite')).toBe(`http://${H}/pro/login`);
  });

  it.each(['PROFESIONALES.TURNETTO.COM', 'profesionales.turnetto.com:443', 'Profesionales.Turnetto.com:3000', 'profesionales.turnetto.com.'])(
    'el host %s se normaliza y es el portal',
    (host) => {
      const res = middleware(requestA('/login', host));
      expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/pro\/login$/);
    },
  );

  it('un host que solo empieza igual NO es el portal (no matchea por prefijo de texto)', () => {
    const evil = 'profesionales.turnetto.com.evil.com';
    verificar('/login', evil, { tipo: 'pasa' });
    verificar('/pro/x', evil, { tipo: '404' });
  });
});

describe('middleware — profesionales.turnetto.com, estáticos y mapa de assets', () => {
  const H = 'profesionales.turnetto.com';

  it.each([
    ['manifest', '/manifest.json', `http://${H}/pro-manifest.json`],
    ['icon-192', '/icon-192.png', `http://${H}/pro-icon-192.png`],
    ['icon-512', '/icon-512.png', `http://${H}/pro-icon-512.png`],
  ])('%s se mapea al asset propio del portal', (_nombre, path, destino) => {
    verificar(path, H, { tipo: 'rewrite', destino });
  });

  it.each(['/sw.js', '/_next/static/x.js', '/splash/a.png', '/pro-icon-192.png', '/pro-manifest.json', '/workbox-965a1397.js', '/favicon.ico'])(
    '%s pasa sin tocar',
    (path) => {
      verificar(path, H, { tipo: 'pasa' });
    },
  );

  it('el manifest de app.turnetto.com no cambia', () => {
    verificar('/manifest.json', 'app.turnetto.com', { tipo: 'pasa' });
  });
});

describe('middleware — /pro* no existe fuera del host del portal', () => {
  it.each(['/pro', '/pro/', '/pro/login', '/pro/agenda/1'])('app.turnetto.com %s -> 404', (path) => {
    verificar(path, 'app.turnetto.com', { tipo: '404' });
  });

  it.each(['/pro', '/pro/login'])('admin.turnetto.com %s -> 404', (path) => {
    verificar(path, 'admin.turnetto.com', { tipo: '404' });
  });

  it('reservar.turnetto.com /pro/login NO es el portal: sigue siendo el slug "pro" de reservar', () => {
    verificar('/pro/login', 'reservar.turnetto.com', {
      tipo: 'rewrite',
      destino: 'http://reservar.turnetto.com/reservar/pro/login',
    });
  });

  it.each(['otro.example.org', 'turnetto.com', 'www.turnetto.com', '203.0.113.7'])('host externo desconocido %s: /pro/x -> 404', (host) => {
    verificar('/pro/x', host, { tipo: '404' });
    verificar('/pro', host, { tipo: '404' });
  });

  it.each(['localhost:3000', 'localhost', '127.0.0.1:3000'])('host interno %s: /pro/login pasa sin 404 ni rewrite', (host) => {
    verificar('/pro/login', host, { tipo: 'pasa' });
    verificar('/pro', host, { tipo: 'pasa' });
  });

  describe.each(['app.turnetto.com', 'otro.example.org', 'localhost:3000'])('host %s', (host) => {
    it.each(['/professionals', '/prox', '/pro-manifest.json'])('%s no se confunde con /pro* (pasa)', (path) => {
      verificar(path, host, { tipo: 'pasa' });
    });
  });

  it('reservar.turnetto.com: /pro-manifest.json es un estático y pasa; /prox es un slug', () => {
    verificar('/pro-manifest.json', 'reservar.turnetto.com', { tipo: 'pasa' });
    verificar('/prox', 'reservar.turnetto.com', { tipo: 'rewrite', destino: 'http://reservar.turnetto.com/reservar/prox' });
  });

  it('admin.turnetto.com: /pro-manifest.json es un estático y pasa (no es /pro*)', () => {
    verificar('/pro-manifest.json', 'admin.turnetto.com', { tipo: 'pasa' });
  });
});

describe('middleware — matcher', () => {
  const [patron] = config.matcher;
  const re = new RegExp(`^${patron}$`);

  it.each(['/api', '/api/clientes', '/_next/static/chunks/x.js', '/_next/image', '/_next'])(
    '%s queda fuera del middleware',
    (path) => {
      expect(re.test(path)).toBe(false);
    },
  );

  it.each(['/', '/login', '/admin/login', '/sw.js', '/splash/a.png', '/clientes'])('%s entra al middleware', (path) => {
    expect(re.test(path)).toBe(true);
  });
});
