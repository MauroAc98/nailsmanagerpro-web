import { describe, expect, it } from 'vitest';
import { claseDeRutaPro, resolveProRoute, type RutaPro, type SnapshotRutaPro } from './resolveProRoute';

const PERMITE: RutaPro = { type: 'allow' };
const BLANCO: RutaPro = { type: 'blank' };
const redirige = (to: string): RutaPro => ({ type: 'redirect', to });

// Todas las pantallas del portal (rutas limpias) más algunas que no existen.
// Los slices siguientes solo agregan páginas: la tabla de rutas ya las conoce.
const RUTAS = [
  '/',
  '/login',
  '/olvide-password',
  '/restablecer-password',
  '/cambiar-password',
  '/negocios',
  '/agenda',
  '/turnos/12',
  '/cuenta',
  '/acceso-deshabilitado',
  '/sin-servicio',
  '/no-disponible',
  '/no-existe',
  '/agenda/otra',
] as const;

type Caso = { nombre: string; snapshot: SnapshotRutaPro; permitidas: string[]; destino: string };

const CASOS: Caso[] = [
  {
    nombre: 'anonymous',
    snapshot: { status: 'anonymous', acceso: 'listo' },
    permitidas: ['/login', '/olvide-password', '/restablecer-password'],
    destino: '/login',
  },
  {
    nombre: 'restricted',
    snapshot: { status: 'restricted', acceso: 'listo' },
    permitidas: ['/cambiar-password'],
    destino: '/cambiar-password',
  },
  {
    nombre: 'portalUnavailable',
    snapshot: { status: 'portalUnavailable', acceso: 'listo' },
    permitidas: ['/no-disponible'],
    destino: '/no-disponible',
  },
  {
    nombre: 'full con un negocio listo',
    snapshot: { status: 'full', acceso: 'listo' },
    permitidas: ['/negocios', '/agenda', '/turnos/12', '/cuenta'],
    destino: '/agenda',
  },
  {
    nombre: 'full sin negocio elegido',
    snapshot: { status: 'full', acceso: 'elegir' },
    permitidas: ['/negocios'],
    destino: '/negocios',
  },
  {
    nombre: 'full con acceso deshabilitado',
    snapshot: { status: 'full', acceso: 'deshabilitado' },
    permitidas: ['/acceso-deshabilitado'],
    destino: '/acceso-deshabilitado',
  },
  {
    nombre: 'full sin servicio',
    snapshot: { status: 'full', acceso: 'sinServicio' },
    permitidas: ['/sin-servicio'],
    destino: '/sin-servicio',
  },
];

const prefijado = (ruta: string) => (ruta === '/' ? '/pro' : `/pro${ruta}`);

describe.each(CASOS)('resolveProRoute — $nombre', ({ snapshot, permitidas, destino }) => {
  it.each(RUTAS)('ruta limpia %s', (ruta) => {
    const esperado = permitidas.includes(ruta) ? PERMITE : redirige(destino);
    expect(resolveProRoute(snapshot, ruta)).toEqual(esperado);
  });

  it.each(RUTAS)('ruta bajo /pro (localhost) %s', (ruta) => {
    const esperado = permitidas.includes(ruta) ? PERMITE : redirige(prefijado(destino));
    expect(resolveProRoute(snapshot, prefijado(ruta))).toEqual(esperado);
  });

  it.each(RUTAS)('seguir el redirect de %s termina en allow (sin bucles)', (ruta) => {
    for (const pathname of [ruta, prefijado(ruta)]) {
      const decision = resolveProRoute(snapshot, pathname);
      if (decision.type === 'redirect') expect(resolveProRoute(snapshot, decision.to)).toEqual(PERMITE);
    }
  });
});

describe('resolveProRoute — mientras se resuelve la sesión', () => {
  it.each(['booting', 'loadingMe'] as const)('%s no decide nada: en blanco en cualquier ruta', (status) => {
    for (const ruta of RUTAS) {
      expect(resolveProRoute({ status, acceso: 'listo' }, ruta)).toEqual(BLANCO);
      expect(resolveProRoute({ status, acceso: 'listo' }, prefijado(ruta))).toEqual(BLANCO);
    }
  });
});

describe('resolveProRoute — `acceso` solo cuenta con la sesión completa', () => {
  it.each(['anonymous', 'restricted', 'portalUnavailable'] as const)('%s ignora el acceso', (status) => {
    const base = resolveProRoute({ status, acceso: 'listo' }, '/agenda');
    for (const acceso of ['elegir', 'deshabilitado', 'sinServicio'] as const) {
      expect(resolveProRoute({ status, acceso }, '/agenda')).toEqual(base);
    }
  });
});

describe('resolveProRoute — forma de la ruta', () => {
  const anonimo: SnapshotRutaPro = { status: 'anonymous', acceso: 'listo' };
  const completo: SnapshotRutaPro = { status: 'full', acceso: 'listo' };

  it('la barra final no cambia la clase de la ruta', () => {
    expect(resolveProRoute(anonimo, '/login/')).toEqual(PERMITE);
    expect(resolveProRoute(completo, '/agenda/')).toEqual(PERMITE);
    expect(resolveProRoute(anonimo, '/pro/login/')).toEqual(PERMITE);
  });

  it('/pro/ a secas es la raíz del portal', () => {
    expect(resolveProRoute(anonimo, '/pro/')).toEqual(redirige('/pro/login'));
    expect(resolveProRoute(completo, '/pro')).toEqual(redirige('/pro/agenda'));
  });

  it('una ruta con otra capitalización o con prefijo parcial no existe en el portal', () => {
    expect(resolveProRoute(anonimo, '/Login')).toEqual(redirige('/login'));
    expect(resolveProRoute(anonimo, '/loginx')).toEqual(redirige('/login'));
    expect(resolveProRoute(completo, '/agenda2')).toEqual(redirige('/agenda'));
  });

  it('/turnos exige un id: ni /turnos ni /turnos/1/2 son del portal', () => {
    expect(resolveProRoute(completo, '/turnos')).toEqual(redirige('/agenda'));
    expect(resolveProRoute(completo, '/turnos/')).toEqual(redirige('/agenda'));
    expect(resolveProRoute(completo, '/turnos/1/2')).toEqual(redirige('/agenda'));
    expect(resolveProRoute(completo, '/turnos/7')).toEqual(PERMITE);
  });

  it('un pathname vacío se trata como la raíz', () => {
    expect(resolveProRoute(anonimo, '')).toEqual(redirige('/login'));
  });

  it('el redirect usa el modo del pathname actual: limpio en el host del portal, /pro en localhost', () => {
    expect(resolveProRoute(completo, '/login')).toEqual(redirige('/agenda'));
    expect(resolveProRoute(completo, '/pro/login')).toEqual(redirige('/pro/agenda'));
  });
});

describe('claseDeRutaPro', () => {
  it.each([
    ['/', 'otra'],
    ['/login', 'publica'],
    ['/olvide-password', 'publica'],
    ['/restablecer-password', 'publica'],
    ['/cambiar-password', 'cambiarPassword'],
    ['/negocios', 'negocios'],
    ['/agenda', 'app'],
    ['/cuenta', 'app'],
    ['/turnos/3', 'app'],
    ['/acceso-deshabilitado', 'accesoDeshabilitado'],
    ['/sin-servicio', 'sinServicio'],
    ['/no-disponible', 'noDisponible'],
    ['/login/extra', 'otra'],
    ['/nada', 'otra'],
  ])('%s -> %s', (ruta, clase) => {
    expect(claseDeRutaPro(ruta)).toBe(clase);
  });
});
