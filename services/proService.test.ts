import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import proApi, { proErrorDe } from '@/lib/proApi';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import { proService } from './proService';

// CONTRATO de red del portal. La clasificación de errores de lib/pro/errores.ts
// decide por el FINAL de la URL (`/pro/login`, `/pro/forgot-password`,
// `/pro/reset-password`...) y proApi decide el header X-Vinculo-Id por el
// prefijo (`/pro/turnos`, `/pro/servicios`). Cambiar una URL del servicio sin
// que falle un test de acá rompería esas reglas en silencio, por eso cada URL,
// método, query y body quedan fijados.
const adapterOriginal = proApi.defaults.adapter;

let enviadas: InternalAxiosRequestConfig[];

function cuerpoEnviado(config: InternalAxiosRequestConfig): unknown {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

function responder(data: unknown, status = 200, headers: Record<string, string> = {}) {
  proApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    enviadas.push(config);
    if (status >= 400) {
      return Promise.reject(
        new AxiosError('fallo', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', data, headers, config }),
      );
    }
    return Promise.resolve({ status, statusText: 'OK', data, headers: {}, config });
  };
}

const SESION_API = { token: 'tok-1', expires_at: '2026-10-17T15:00:00-03:00', debe_cambiar_password: false };
const EXPIRA_MS = Date.parse('2026-10-17T15:00:00-03:00');

const TURNO_API = {
  id: 41,
  fecha_hora: '2026-10-17T09:30:00',
  duracion_total_minutos: 60,
  estado_visual: 'confirmado',
  notas: null,
  cliente: { nombre: 'Ana', apellido: 'Pérez' },
  servicios: [{ id: 7, nombre: 'Gel' }],
  promo: null,
  origen: null,
};

let sesionExpirada: ReturnType<typeof vi.fn>;
let portalNoDisponible: ReturnType<typeof vi.fn>;

beforeEach(() => {
  enviadas = [];
  localStorage.clear();
  sesionExpirada = vi.fn();
  portalNoDisponible = vi.fn();
  window.addEventListener('pro-session-expired', sesionExpirada);
  window.addEventListener('pro-portal-unavailable', portalNoDisponible);
});

afterEach(() => {
  window.removeEventListener('pro-session-expired', sesionExpirada);
  window.removeEventListener('pro-portal-unavailable', portalNoDisponible);
  proApi.defaults.adapter = adapterOriginal;
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('proService — contrato de endpoints de autenticación', () => {
  it('login: POST /pro/login con {email, password} y sin X-Vinculo-Id ni dispositivo', async () => {
    responder(SESION_API);
    await proService.login('sol@mail.com', 'secreta-123');

    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].method).toBe('post');
    expect(enviadas[0].url).toBe('/pro/login');
    expect(cuerpoEnviado(enviadas[0])).toEqual({ email: 'sol@mail.com', password: 'secreta-123' });
    expect(enviadas[0].headers.has('X-Vinculo-Id')).toBe(false);
  });

  it('cambiarPassword: POST /pro/cambiar-password con {password, password_confirmation}', async () => {
    responder({ ...SESION_API, debe_cambiar_password: false });
    await proService.cambiarPassword('nueva-clave-1', 'nueva-clave-1');

    expect(enviadas[0].method).toBe('post');
    expect(enviadas[0].url).toBe('/pro/cambiar-password');
    expect(cuerpoEnviado(enviadas[0])).toEqual({ password: 'nueva-clave-1', password_confirmation: 'nueva-clave-1' });
    expect(enviadas[0].headers.has('X-Vinculo-Id')).toBe(false);
  });

  it('forgotPassword: POST /pro/forgot-password con {email}', async () => {
    responder({ message: 'ok' });
    await proService.forgotPassword('sol@mail.com');

    expect(enviadas[0].method).toBe('post');
    expect(enviadas[0].url).toBe('/pro/forgot-password');
    expect(cuerpoEnviado(enviadas[0])).toEqual({ email: 'sol@mail.com' });
  });

  it('resetPassword: POST /pro/reset-password con exactamente {email, code, password, password_confirmation}', async () => {
    responder({ message: 'ok' });
    await proService.resetPassword({
      email: 'sol@mail.com',
      code: '123456',
      password: 'nueva-clave-1',
      password_confirmation: 'nueva-clave-1',
    });

    expect(enviadas[0].method).toBe('post');
    expect(enviadas[0].url).toBe('/pro/reset-password');
    expect(cuerpoEnviado(enviadas[0])).toEqual({
      email: 'sol@mail.com',
      code: '123456',
      password: 'nueva-clave-1',
      password_confirmation: 'nueva-clave-1',
    });
  });

  it('resetPassword no reenvía campos de más aunque el llamador los pase', async () => {
    responder({});
    const conExtra = {
      email: 'a@b.c',
      code: '123456',
      password: 'x'.repeat(10),
      password_confirmation: 'x'.repeat(10),
      token: 'no-debe-viajar',
    };
    await proService.resetPassword(conExtra);
    expect(Object.keys(cuerpoEnviado(enviadas[0]) as object).sort()).toEqual(['code', 'email', 'password', 'password_confirmation']);
  });

  it('logout: POST /pro/logout sin cuerpo y sin X-Vinculo-Id', async () => {
    responder('', 204);
    await proService.logout();

    expect(enviadas[0].method).toBe('post');
    expect(enviadas[0].url).toBe('/pro/logout');
    expect(enviadas[0].data).toBeUndefined();
    expect(enviadas[0].headers.has('X-Vinculo-Id')).toBe(false);
  });

  it('me: GET /pro/me sin X-Vinculo-Id', async () => {
    responder({ cuenta: { email: 'sol@mail.com' }, vinculos: [] });
    await proService.me();

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/me');
    expect(enviadas[0].headers.has('X-Vinculo-Id')).toBe(false);
  });
});

describe('proService — contrato de endpoints de datos (X-Vinculo-Id explícito)', () => {
  it('turnos por día: GET /pro/turnos?fecha con el header del vínculo', async () => {
    responder({ data: [TURNO_API], truncated: false });
    await proService.turnos(12, { fecha: '2026-10-17' });

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/turnos');
    expect(enviadas[0].params).toEqual({ fecha: '2026-10-17' });
    expect(enviadas[0].headers.get('X-Vinculo-Id')).toBe('12');
  });

  it('turnos por rango con filtros: desde, hasta, buscar y servicio_id (nunca fecha)', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(12, { desde: '2026-10-01', hasta: '2026-10-31', buscar: 'ana', servicio_id: 7 });

    expect(enviadas[0].params).toEqual({ desde: '2026-10-01', hasta: '2026-10-31', buscar: 'ana', servicio_id: 7 });
    expect(enviadas[0].params).not.toHaveProperty('fecha');
  });

  it('turnos por día con filtros también manda buscar y servicio_id', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(3, { fecha: '2026-10-17', buscar: 'ana', servicio_id: 9 });

    expect(enviadas[0].params).toEqual({ fecha: '2026-10-17', buscar: 'ana', servicio_id: 9 });
  });

  it('omite los filtros vacíos o sin definir', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(3, { desde: '2026-10-01', hasta: '2026-10-31', buscar: '   ', servicio_id: undefined });

    expect(enviadas[0].params).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
  });

  it('marcas: GET /pro/turnos/marcas?mes con el header', async () => {
    responder({ mes: '2026-10', dias: [{ fecha: '2026-10-17', cantidad: 2 }] });
    await proService.marcas(12, '2026-10');

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/turnos/marcas');
    expect(enviadas[0].params).toEqual({ mes: '2026-10' });
    expect(enviadas[0].headers.get('X-Vinculo-Id')).toBe('12');
  });

  it('resumen: GET /pro/resumen?mes con el header', async () => {
    responder({ mes: '2026-10', atendidos: 3, por_venir: 2, cancelados: 1, mas_pedido: { nombre: 'Gel' } });
    const resumen = await proService.resumen(12, '2026-10');

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/resumen');
    expect(enviadas[0].params).toEqual({ mes: '2026-10' });
    expect(enviadas[0].headers.get('X-Vinculo-Id')).toBe('12');
    expect(resumen).toEqual({ atendidos: 3, por_venir: 2, cancelados: 1, mas_pedido: 'Gel' });
  });

  it('resumen: una respuesta 200 sin la forma del contrato es un fallo del servidor', async () => {
    responder({ message: 'Server Error' });
    const error = await proService.resumen(12, '2026-10').catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'server' });
  });

  it('turno: GET /pro/turnos/{id} con el header', async () => {
    responder(TURNO_API);
    await proService.turno(12, 41);

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/turnos/41');
    expect(enviadas[0].headers.get('X-Vinculo-Id')).toBe('12');
  });

  it('servicios: GET /pro/servicios con el header', async () => {
    responder([{ id: 7, nombre: 'Gel' }]);
    await proService.servicios(12);

    expect(enviadas[0].method).toBe('get');
    expect(enviadas[0].url).toBe('/pro/servicios');
    expect(enviadas[0].headers.get('X-Vinculo-Id')).toBe('12');
  });

  it('cada llamada lleva SU vínculo: no hay un "vínculo activo" global', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(12, { fecha: '2026-10-17' });
    await proService.turnos(99, { fecha: '2026-10-17' });

    expect(enviadas.map((c) => c.headers.get('X-Vinculo-Id'))).toEqual(['12', '99']);
  });

  it('reenvía el AbortSignal al request', async () => {
    const controlador = new AbortController();
    responder({ data: [], truncated: false });
    await proService.turnos(12, { fecha: '2026-10-17' }, controlador.signal);
    responder({ mes: '2026-10', dias: [] });
    await proService.marcas(12, '2026-10', controlador.signal);
    responder({ atendidos: 0, por_venir: 0, cancelados: 0, mas_pedido: null });
    await proService.resumen(12, '2026-10', controlador.signal);
    responder([]);
    await proService.servicios(12, controlador.signal);
    responder(TURNO_API);
    await proService.turno(12, 41, controlador.signal);

    expect(enviadas.map((c) => c.signal)).toEqual([
      controlador.signal,
      controlador.signal,
      controlador.signal,
      controlador.signal,
      controlador.signal,
    ]);
  });

  it('un id de vínculo inválido no sale a la red y se clasifica vinculoRequired', async () => {
    responder({ data: [], truncated: false });
    for (const id of [0, -1, Number.NaN, 1.5]) {
      const error = await proService.turnos(id, { fecha: '2026-10-17' }).catch((e: unknown) => e);
      expect(proErrorDe(error)).toEqual({ kind: 'vinculoRequired' });
    }
    expect(enviadas).toHaveLength(0);
  });
});

describe('proService — parámetros de turnos (fail-fast, nunca strings vacíos)', () => {
  it('recorta buscar antes de enviarlo', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(3, { fecha: '2026-10-17', buscar: '  ana  ' });
    expect(enviadas[0].params).toEqual({ fecha: '2026-10-17', buscar: 'ana' });
  });

  it('no envía fecha, desde, hasta, buscar ni servicio_id vacíos', async () => {
    responder({ data: [], truncated: false });
    const vacios = { fecha: '2026-10-17', buscar: '', servicio_id: '' as unknown as number };
    await proService.turnos(3, vacios);
    expect(enviadas[0].params).toEqual({ fecha: '2026-10-17' });

    await proService.turnos(3, { fecha: '2026-10-17', desde: '', hasta: '', buscar: '\t' } as never);
    expect(enviadas[1].params).toEqual({ fecha: '2026-10-17' });

    await proService.turnos(3, { desde: '2026-10-01', hasta: '2026-10-31', fecha: '' } as never);
    expect(enviadas[2].params).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
  });

  it('no envía null ni undefined', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(3, { fecha: '2026-10-17', buscar: null, servicio_id: null } as never);
    expect(enviadas[0].params).toEqual({ fecha: '2026-10-17' });
  });

  it.each([
    ['fecha junto con desde y hasta', { fecha: '2026-10-17', desde: '2026-10-01', hasta: '2026-10-31' }, 'fecha'],
    ['fecha junto con desde', { fecha: '2026-10-17', desde: '2026-10-01' }, 'fecha'],
    ['desde sin hasta', { desde: '2026-10-01' }, 'hasta'],
    ['hasta sin desde', { hasta: '2026-10-31' }, 'desde'],
  ])('rechaza antes de la red: %s', async (_nombre, filtros, campo) => {
    responder({ data: [], truncated: false });
    const error = await proService.turnos(3, filtros as never).catch((e: unknown) => e);

    const proError = proErrorDe(error);
    expect(proError.kind).toBe('validation');
    expect(proError.kind === 'validation' && Object.keys(proError.fields)).toEqual([campo]);
    expect(enviadas).toHaveLength(0);
  });

  it('sin ninguna fecha es válido: el backend usa hoy por defecto', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(3, { buscar: 'ana' } as never);
    expect(enviadas[0].params).toEqual({ buscar: 'ana' });
  });

  it.each([0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])('rechaza servicio_id %s antes de la red', async (servicioId) => {
    responder({ data: [], truncated: false });
    const error = await proService.turnos(3, { fecha: '2026-10-17', servicio_id: servicioId }).catch((e: unknown) => e);

    const proError = proErrorDe(error);
    expect(proError.kind === 'validation' && Object.keys(proError.fields)).toEqual(['servicio_id']);
    expect(enviadas).toHaveLength(0);
  });
});

describe('proService — turno(id): la compuerta del id reemplaza al encoding', () => {
  it('manda un id entero positivo tal cual en la ruta', async () => {
    responder(TURNO_API);
    await proService.turno(12, 41);
    await proService.turno(12, Number.MAX_SAFE_INTEGER);

    expect(enviadas.map((c) => c.url)).toEqual(['/pro/turnos/41', `/pro/turnos/${Number.MAX_SAFE_INTEGER}`]);
  });

  it.each([
    ['cero', 0],
    ['negativo', -1],
    ['decimal', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['mayor que el entero seguro', 2 ** 53],
    ['notación científica', 1e21],
    ['un path con ..', '5/../../me'],
    ['con query', '41?vinculo=2'],
    ['con barra', '41/otra'],
    ['texto numérico', '41'],
    ['null', null],
    ['undefined', undefined],
  ])('rechaza un id inválido (%s) antes de la red, como no encontrado', async (_nombre, id) => {
    responder(TURNO_API);
    const error = await proService.turno(12, id as unknown as number).catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'notFound' });
    expect(enviadas).toHaveLength(0);
  });
});

describe('proService — el portal solo lee (G1)', () => {
  it('los únicos métodos que no son GET son los de autenticación', async () => {
    responder({ data: [], truncated: false });
    await proService.turnos(1, { fecha: '2026-10-17' }).catch(() => undefined);
    await proService.marcas(1, '2026-10').catch(() => undefined);
    await proService.resumen(1, '2026-10').catch(() => undefined);
    await proService.turno(1, 5).catch(() => undefined);
    await proService.servicios(1).catch(() => undefined);
    await proService.me().catch(() => undefined);
    expect(enviadas.map((c) => c.method)).toEqual(['get', 'get', 'get', 'get', 'get', 'get']);

    enviadas = [];
    responder(SESION_API);
    await proService.login('a@b.c', 'x').catch(() => undefined);
    await proService.cambiarPassword('a', 'a').catch(() => undefined);
    await proService.forgotPassword('a@b.c').catch(() => undefined);
    await proService.resetPassword({ email: 'a@b.c', code: '1', password: 'a', password_confirmation: 'a' }).catch(() => undefined);
    await proService.logout().catch(() => undefined);
    expect(enviadas.map((c) => `${c.method} ${c.url}`)).toEqual([
      'post /pro/login',
      'post /pro/cambiar-password',
      'post /pro/forgot-password',
      'post /pro/reset-password',
      'post /pro/logout',
    ]);
  });
});

describe('proService — la URL decide la clasificación del error', () => {
  const LLAMADAS: [string, () => Promise<unknown>][] = [
    ['login', () => proService.login('a@b.c', 'x')],
    ['cambiarPassword', () => proService.cambiarPassword('x', 'x')],
    ['forgotPassword', () => proService.forgotPassword('a@b.c')],
    ['resetPassword', () => proService.resetPassword({ email: 'a@b.c', code: '1', password: 'x', password_confirmation: 'x' })],
    ['logout', () => proService.logout()],
    ['me', () => proService.me()],
    ['turnos', () => proService.turnos(1, { fecha: '2026-10-17' })],
    ['marcas', () => proService.marcas(1, '2026-10')],
    ['resumen', () => proService.resumen(1, '2026-10')],
    ['turno', () => proService.turno(1, 5)],
    ['servicios', () => proService.servicios(1)],
  ];

  it.each([
    ['login', { kind: 'invalidCredentials' }, 0],
    ['cambiarPassword', { kind: 'sessionRevoked' }, 1],
    ['forgotPassword', { kind: 'server' }, 0],
    ['resetPassword', { kind: 'server' }, 0],
    ['logout', { kind: 'sessionRevoked' }, 1],
    ['me', { kind: 'sessionRevoked' }, 1],
    ['turnos', { kind: 'sessionRevoked' }, 1],
    ['marcas', { kind: 'sessionRevoked' }, 1],
    ['resumen', { kind: 'sessionRevoked' }, 1],
    ['turno', { kind: 'sessionRevoked' }, 1],
    ['servicios', { kind: 'sessionRevoked' }, 1],
  ])('401 en %s se clasifica %j y emite %i evento(s) de sesión', async (nombre, esperado, eventos) => {
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok-1');
    responder({ message: 'Unauthenticated.' }, 401);
    const llamada = LLAMADAS.find(([n]) => n === nombre)![1];

    const error = await llamada().catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual(esperado);
    expect(sesionExpirada).toHaveBeenCalledTimes(eventos);
  });

  it.each(LLAMADAS.map(([nombre]) => nombre))('404 en %s es portalUnavailable y avisa al portal', async (nombre) => {
    responder({ message: 'Not Found' }, 404);
    const llamada = LLAMADAS.find(([n]) => n === nombre)![1];

    const error = await llamada().catch((e: unknown) => e);

    expect(proErrorDe(error).kind).toBe('portalUnavailable');
    expect(portalNoDisponible).toHaveBeenCalledTimes(1);
  });

  it('404 TURNO_NO_ENCONTRADO en turno es notFound y no avisa que el portal cayó', async () => {
    responder({ message: 'No encontramos ese turno.', code: 'TURNO_NO_ENCONTRADO' }, 404);
    const error = await proService.turno(1, 5).catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'notFound' });
    expect(portalNoDisponible).not.toHaveBeenCalled();
  });

  it('422 de reset-password trae los errores por campo', async () => {
    responder({ message: 'x', errors: { code: ['El código es incorrecto o venció. Pedí uno nuevo.'] } }, 422);
    const error = await proService
      .resetPassword({ email: 'a@b.c', code: '1', password: 'x', password_confirmation: 'x' })
      .catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({
      kind: 'validation',
      fields: { code: ['El código es incorrecto o venció. Pedí uno nuevo.'] },
    });
  });
});

describe('proService — sesión del login', () => {
  it('login con debe_cambiar_password=false es full y expiresAt sale de expires_at', async () => {
    responder(SESION_API);
    await expect(proService.login('a@b.c', 'x')).resolves.toEqual({ token: 'tok-1', tipo: 'full', expiresAt: EXPIRA_MS });
  });

  it('login con debe_cambiar_password=true es restricted', async () => {
    responder({ ...SESION_API, debe_cambiar_password: true });
    await expect(proService.login('a@b.c', 'x')).resolves.toEqual({ token: 'tok-1', tipo: 'restricted', expiresAt: EXPIRA_MS });
  });

  it('cambiarPassword devuelve el token full que reemplaza al restringido', async () => {
    responder({ token: 'tok-full', expires_at: '2026-10-17T15:00:00-03:00', debe_cambiar_password: false });
    await expect(proService.cambiarPassword('x', 'x')).resolves.toEqual({ token: 'tok-full', tipo: 'full', expiresAt: EXPIRA_MS });
  });

  it('un expires_at ilegible deja expiresAt en null', async () => {
    responder({ ...SESION_API, expires_at: 'mañana' });
    await expect(proService.login('a@b.c', 'x')).resolves.toMatchObject({ expiresAt: null });
    responder({ token: 'tok-1', debe_cambiar_password: false });
    await expect(proService.login('a@b.c', 'x')).resolves.toMatchObject({ expiresAt: null });
  });

  it('un expires_at sin zona horaria no se interpreta como hora local: expiresAt null', async () => {
    responder({ ...SESION_API, expires_at: '2026-10-17T15:00:00' });
    await expect(proService.login('a@b.c', 'x')).resolves.toMatchObject({ expiresAt: null });
  });

  it('un expires_at en UTC (Z) o con offset da el mismo instante', async () => {
    responder({ ...SESION_API, expires_at: '2026-10-17T18:00:00.000000Z' });
    await expect(proService.login('a@b.c', 'x')).resolves.toMatchObject({ expiresAt: EXPIRA_MS });
  });

  it.each([
    ['sin token', { expires_at: SESION_API.expires_at, debe_cambiar_password: false }],
    ['token vacío', { ...SESION_API, token: '' }],
    ['token que no es texto', { ...SESION_API, token: 123 }],
    ['debe_cambiar_password ausente', { token: 'tok-1', expires_at: SESION_API.expires_at }],
    ['debe_cambiar_password que no es booleano', { ...SESION_API, debe_cambiar_password: 'false' }],
    ['cuerpo vacío', ''],
  ])('una respuesta inválida (%s) se rechaza como error de servidor, sin sesión', async (_nombre, cuerpo) => {
    responder(cuerpo);
    const error = await proService.login('a@b.c', 'x').catch((e: unknown) => e);
    expect(proErrorDe(error)).toEqual({ kind: 'server' });
  });
});

describe('proService — datos parseados con lista blanca', () => {
  it('turnos devuelve la lista parseada: sin claves ajenas, ordenada y con truncated', async () => {
    responder({
      data: [
        { ...TURNO_API, id: 2, fecha_hora: '2026-10-17T15:00:00', telefono: '1155550000', precio_total: 9000 },
        { ...TURNO_API, id: 1, fecha_hora: '2026-10-17T09:30:00', sena: 500 },
      ],
      truncated: true,
    });
    const { turnos, truncated, descartados } = await proService.turnos(12, { fecha: '2026-10-17' });

    expect(turnos.map((t) => t.id)).toEqual([1, 2]);
    expect(truncated).toBe(true);
    expect(descartados).toBe(0);
    expect(JSON.stringify(turnos)).not.toMatch(/1155550000|9000|sena|telefono|precio/);
  });

  it('turno devuelve el detalle parseado y rechaza un cuerpo que no es un turno', async () => {
    responder({ ...TURNO_API, telefono: '1155550000' });
    const detalle = await proService.turno(12, 41);
    expect(detalle.id).toBe(41);
    expect('telefono' in detalle).toBe(false);

    responder({ message: 'algo raro' });
    const error = await proService.turno(12, 41).catch((e: unknown) => e);
    expect(proErrorDe(error)).toEqual({ kind: 'server' });
  });

  it('me devuelve email y vínculos parseados', async () => {
    responder({
      cuenta: { email: 'sol@mail.com' },
      vinculos: [{ id: 12, negocio: { nombre: 'Luna' }, profesional: { nombre: 'Sol', apellido: null, avatar_url: null }, disponible: true, motivo: null }],
    });
    await expect(proService.me()).resolves.toEqual({
      email: 'sol@mail.com',
      vinculos: [
        { id: 12, negocioNombre: 'Luna', profesional: { nombre: 'Sol', apellido: null, avatar_url: null }, disponible: true, motivo: null },
      ],
      descartados: 0,
    });
  });

  it('marcas y servicios devuelven los datos parseados', async () => {
    responder({ mes: '2026-10', dias: [{ fecha: '2026-10-17', cantidad: 2, extra: 1 }] });
    await expect(proService.marcas(12, '2026-10')).resolves.toEqual({
      dias: [{ fecha: '2026-10-17', cantidad: 2 }],
      descartados: 0,
    });

    responder([{ id: 7, nombre: 'Gel', precio: 100, duracion_minutos: 45, categoria: { id: 2, nombre: 'Manos', user_id: 1 } }]);
    await expect(proService.servicios(12)).resolves.toEqual({
      servicios: [{ id: 7, nombre: 'Gel', duracion_minutos: 45, categoria: { id: 2, nombre: 'Manos' } }],
      descartados: 0,
    });
  });
});

// Un 200 que no tiene la forma del contrato (cuerpo de error JSON, HTML de un
// portal cautivo, un proxy) NO es "no hay datos": es un error del servidor.
describe('proService — un 200 con forma inválida es error de servidor, no una lista vacía', () => {
  const CUERPOS_INVALIDOS: [string, unknown][] = [
    ['cuerpo { message }', { message: 'Server Error' }],
    ['HTML de un portal cautivo', '<html><body>Iniciá sesión en el WiFi</body></html>'],
    ['cuerpo vacío', ''],
    ['null', null],
  ];

  const LLAMADAS: [string, () => Promise<unknown>][] = [
    ['turnos', () => proService.turnos(12, { fecha: '2026-10-17' })],
    ['marcas', () => proService.marcas(12, '2026-10')],
    ['servicios', () => proService.servicios(12)],
    ['me', () => proService.me()],
  ];

  describe.each(LLAMADAS)('%s', (_nombre, llamar) => {
    it.each(CUERPOS_INVALIDOS)('rechaza %s con kind server', async (_cuerpo, cuerpo) => {
      responder(cuerpo);
      const error = await llamar().catch((e: unknown) => e);
      expect(proErrorDe(error)).toEqual({ kind: 'server' });
      // El error es el rechazo explícito del servicio, no un TypeError que
      // casualmente cae a "server" en proErrorDe.
      expect((error as Error).name).toBe('Error');
      expect((error as Error).message).toMatch(/^Respuesta inválida del portal/);
    });
  });

  it('data / dias / vinculos presentes pero que no son listas también se rechazan', async () => {
    responder({ data: { 0: TURNO_API }, truncated: false });
    expect(proErrorDe(await proService.turnos(12, { fecha: '2026-10-17' }).catch((e: unknown) => e))).toEqual({ kind: 'server' });

    responder({ mes: '2026-10', dias: 'x' });
    expect(proErrorDe(await proService.marcas(12, '2026-10').catch((e: unknown) => e))).toEqual({ kind: 'server' });

    responder({ data: [{ id: 7, nombre: 'Gel' }] });
    expect(proErrorDe(await proService.servicios(12).catch((e: unknown) => e))).toEqual({ kind: 'server' });

    responder({ cuenta: { email: 'a@b.c' }, vinculos: { 0: {} } });
    expect(proErrorDe(await proService.me().catch((e: unknown) => e))).toEqual({ kind: 'server' });
  });

  it('una lista vacía legítima sigue siendo éxito en los cuatro endpoints', async () => {
    responder({ data: [], truncated: false });
    await expect(proService.turnos(12, { fecha: '2026-10-17' })).resolves.toEqual({ turnos: [], truncated: false, descartados: 0 });
    responder({ mes: '2026-10', dias: [] });
    await expect(proService.marcas(12, '2026-10')).resolves.toEqual({ dias: [], descartados: 0 });
    responder([]);
    await expect(proService.servicios(12)).resolves.toEqual({ servicios: [], descartados: 0 });
    responder({ cuenta: { email: 'a@b.c' }, vinculos: [] });
    await expect(proService.me()).resolves.toEqual({ email: 'a@b.c', vinculos: [], descartados: 0 });
  });

  it('si el parser descartó filas inválidas sigue siendo éxito y expone cuántas', async () => {
    responder({ data: [TURNO_API, null, { id: 'x' }], truncated: false });
    const lista = await proService.turnos(12, { fecha: '2026-10-17' });
    expect(lista.turnos.map((t) => t.id)).toEqual([41]);
    expect(lista.descartados).toBe(2);

    responder({ mes: '2026-10', dias: [{ fecha: '2026-10-17', cantidad: 1 }, { fecha: 'x', cantidad: 1 }] });
    expect((await proService.marcas(12, '2026-10')).descartados).toBe(1);

    responder([{ id: 7, nombre: 'Gel' }, { id: 0 }, null]);
    expect((await proService.servicios(12)).descartados).toBe(2);

    responder({ cuenta: { email: 'a@b.c' }, vinculos: [{ id: 'x' }] });
    expect((await proService.me()).descartados).toBe(1);
  });

  it('si TODAS las filas son inválidas es éxito vacío con todo descartado (la UI decide)', async () => {
    responder({ data: [null, { id: 'x' }, 'fila'], truncated: false });
    await expect(proService.turnos(12, { fecha: '2026-10-17' })).resolves.toEqual({ turnos: [], truncated: false, descartados: 3 });

    responder({ mes: '2026-10', dias: [null, { fecha: 'x' }] });
    await expect(proService.marcas(12, '2026-10')).resolves.toEqual({ dias: [], descartados: 2 });

    responder([null, { id: 0 }]);
    await expect(proService.servicios(12)).resolves.toEqual({ servicios: [], descartados: 2 });

    responder({ cuenta: { email: 'a@b.c' }, vinculos: [null] });
    await expect(proService.me()).resolves.toEqual({ email: 'a@b.c', vinculos: [], descartados: 1 });
  });
});

describe('proService — persistencia de la sesión (SE-4)', () => {
  const AHORA = Date.parse('2026-10-17T12:00:00Z');
  const FUTURO = AHORA + 60 * 60 * 1000;

  it('guardarSesion persiste token, tipo y expiración bajo las keys del portal', () => {
    expect(proService.guardarSesion({ token: 'tok-1', tipo: 'restricted', expiresAt: FUTURO })).toBe(true);

    expect(localStorage.getItem('pro_token')).toBe('tok-1');
    expect(localStorage.getItem('pro_token_tipo')).toBe('restricted');
    expect(localStorage.getItem('pro_token_expires_at')).toBe(String(FUTURO));
  });

  it('leerSesion restaura una sesión vigente, incluida la restringida sin llamar a me', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'restricted', expiresAt: FUTURO });
    expect(proService.leerSesion(AHORA)).toEqual({
      estado: 'vigente',
      sesion: { token: 'tok-1', tipo: 'restricted', expiresAt: FUTURO },
    });

    proService.guardarSesion({ token: 'tok-2', tipo: 'full', expiresAt: FUTURO });
    expect(proService.leerSesion(AHORA)).toEqual({
      estado: 'vigente',
      sesion: { token: 'tok-2', tipo: 'full', expiresAt: FUTURO },
    });
    expect(enviadas).toHaveLength(0);
  });

  it('sin token no hay sesión', () => {
    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
  });

  it('una sesión vencida se borra y se avisa como expirada, sin tocar la red', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: AHORA - 1000 });

    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'expirada' });
    expect(localStorage.getItem('pro_token')).toBeNull();
    expect(localStorage.getItem('pro_token_tipo')).toBeNull();
    expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
    expect(enviadas).toHaveLength(0);
  });

  it('vence justo en el instante de expiresAt (falla cerrado)', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: AHORA });
    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'expirada' });
  });

  it.each([
    ['expiración ausente', (): void => localStorage.removeItem('pro_token_expires_at')],
    ['expiración corrupta', (): void => localStorage.setItem('pro_token_expires_at', 'no-es-un-numero')],
    ['expiración con decimales', (): void => localStorage.setItem('pro_token_expires_at', '1.5')],
    ['expiración negativa', (): void => localStorage.setItem('pro_token_expires_at', '-5')],
    ['tipo ausente', (): void => localStorage.removeItem('pro_token_tipo')],
    ['tipo desconocido', (): void => localStorage.setItem('pro_token_tipo', 'admin')],
    ['token vacío', (): void => localStorage.setItem('pro_token', '')],
  ])('%s: no hay sesión y se limpia lo que quedó', (_nombre, corromper) => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: FUTURO });
    corromper();

    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
    expect(localStorage.getItem('pro_token')).toBeNull();
    expect(localStorage.getItem('pro_token_tipo')).toBeNull();
    expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
  });

  it('un login sin expiración legible no deja una sesión restaurable (falla cerrado)', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: null });

    expect(localStorage.getItem('pro_token')).toBe('tok-1');
    expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
  });

  it('guardar una sesión nueva reemplaza la restringida por la full', () => {
    proService.guardarSesion({ token: 'tok-r', tipo: 'restricted', expiresAt: FUTURO });
    proService.guardarSesion({ token: 'tok-f', tipo: 'full', expiresAt: FUTURO + 1000 });

    expect(proService.leerSesion(AHORA)).toEqual({
      estado: 'vigente',
      sesion: { token: 'tok-f', tipo: 'full', expiresAt: FUTURO + 1000 },
    });
  });

  it('borrarSesion limpia solo las 3 keys de sesión del portal', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: FUTURO });
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '12');
    localStorage.setItem('auth_token', 'tok-tenant');
    localStorage.setItem('admin_token', 'tok-admin');

    proService.borrarSesion();

    expect(localStorage.getItem('pro_token')).toBeNull();
    expect(localStorage.getItem('pro_token_tipo')).toBeNull();
    expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
    expect(localStorage.getItem('pro_ultimo_vinculo')).toBe('12');
    expect(localStorage.getItem('auth_token')).toBe('tok-tenant');
    expect(localStorage.getItem('admin_token')).toBe('tok-admin');
  });

  // guardarSesion escribe 3 keys. Si una falla a medias no puede quedar un
  // token nuevo junto a un tipo/vencimiento viejos (p. ej. token full con el
  // tipo restricted de antes): se borra todo y se informa false.
  describe.each([
    ['la 1ra', 1],
    ['la 2da', 2],
    ['la 3ra', 3],
  ])('guardarSesion atómico: falla %s escritura', (_nombre, fallaEn) => {
    function fallarEnLaEscritura(n: number) {
      const original = Storage.prototype.setItem;
      let llamadas = 0;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, clave: string, valor: string) {
        llamadas += 1;
        if (llamadas === n) throw new DOMException('cuota excedida', 'QuotaExceededError');
        original.call(this, clave, valor);
      });
    }

    it('devuelve false y no deja ninguna key de sesión (aunque hubiera una sesión previa)', () => {
      proService.guardarSesion({ token: 'tok-viejo', tipo: 'restricted', expiresAt: FUTURO });
      fallarEnLaEscritura(fallaEn);

      expect(proService.guardarSesion({ token: 'tok-nuevo', tipo: 'full', expiresAt: FUTURO + 1000 })).toBe(false);

      expect(localStorage.getItem('pro_token')).toBeNull();
      expect(localStorage.getItem('pro_token_tipo')).toBeNull();
      expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
      expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
    });

    it('no toca las keys ajenas a la sesión', () => {
      localStorage.setItem('pro_ultimo_vinculo', '12');
      localStorage.setItem('auth_token', 'tok-tenant');
      fallarEnLaEscritura(fallaEn);

      proService.guardarSesion({ token: 'tok-nuevo', tipo: 'full', expiresAt: FUTURO });

      expect(localStorage.getItem('pro_ultimo_vinculo')).toBe('12');
      expect(localStorage.getItem('auth_token')).toBe('tok-tenant');
    });
  });

  it('guardarSesion atómico: si falla el borrado del vencimiento (expiresAt null) tampoco queda una sesión a medias', () => {
    proService.guardarSesion({ token: 'tok-viejo', tipo: 'full', expiresAt: FUTURO });
    const original = Storage.prototype.removeItem;
    let primera = true;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, clave: string) {
      // falla solo el primer borrado (el del intento); la limpieza posterior funciona
      if (primera) {
        primera = false;
        throw new DOMException('bloqueado', 'SecurityError');
      }
      original.call(this, clave);
    });

    expect(proService.guardarSesion({ token: 'tok-nuevo', tipo: 'full', expiresAt: null })).toBe(false);

    expect(localStorage.getItem('pro_token')).toBeNull();
    expect(localStorage.getItem('pro_token_tipo')).toBeNull();
    expect(localStorage.getItem('pro_token_expires_at')).toBeNull();
  });

  it('guardarSesion devuelve true cuando las 3 escrituras salen bien', () => {
    expect(proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: FUTURO })).toBe(true);
    expect(proService.leerSesion(AHORA).estado).toBe('vigente');
  });

  // Reloj del dispositivo atrasado o adelantado: el vencimiento se compara
  // contra Date.now() local, así que un reloj adelantado vence la sesión antes
  // y uno atrasado la deja usable más tiempo. No hay corrección de skew: el
  // 401 del servidor sigue siendo la autoridad (proApi emite pro-session-expired).
  it('el vencimiento depende del reloj que se le pasa (documenta el comportamiento ante skew)', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: FUTURO });

    expect(proService.leerSesion(AHORA - 3 * 60 * 60 * 1000).estado).toBe('vigente'); // reloj atrasado 3 h
    expect(proService.leerSesion(FUTURO + 1).estado).toBe('expirada'); // reloj adelantado
  });

  it('si localStorage tira no hay sesión, guardar devuelve false y borrar no explota', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage deshabilitado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage deshabilitado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage deshabilitado');
    });

    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
    expect(proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: FUTURO })).toBe(false);
    expect(() => proService.borrarSesion()).not.toThrow();
  });

  it('leerSesion usa el reloj actual si no se le pasa uno', () => {
    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: Date.now() + 60_000 });
    expect(proService.leerSesion().estado).toBe('vigente');

    proService.guardarSesion({ token: 'tok-1', tipo: 'full', expiresAt: Date.now() - 60_000 });
    expect(proService.leerSesion().estado).toBe('expirada');
  });
});
