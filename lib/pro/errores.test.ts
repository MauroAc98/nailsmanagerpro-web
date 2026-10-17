import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clasificarErrorPro, parseRetryAfter, type ErrorCrudo } from './errores';

function crudo(parcial: Partial<ErrorCrudo>): ErrorCrudo {
  return { status: 400, data: {}, retryAfterHeader: null, url: '/pro/turnos', ...parcial };
}

describe('clasificarErrorPro — tabla SE-3', () => {
  it.each([
    ['404 -> portal no disponible', { status: 404, data: { message: 'Not Found' } }, { kind: 'portalUnavailable' }],
    ['404 sin cuerpo -> portal no disponible', { status: 404, data: '' }, { kind: 'portalUnavailable' }],
    ['404 TURNO_NO_ENCONTRADO -> notFound', { status: 404, data: { code: 'TURNO_NO_ENCONTRADO' } }, { kind: 'notFound' }],
    ['401 Unauthenticated. fuera del login -> sessionRevoked', { status: 401, data: { message: 'Unauthenticated.' } }, { kind: 'sessionRevoked' }],
    ['401 en /pro/login -> invalidCredentials', { status: 401, data: { message: 'x' }, url: '/pro/login' }, { kind: 'invalidCredentials' }],
    ['401 en /pro/login con query o barra -> invalidCredentials', { status: 401, data: {}, url: '/pro/login/?x=1' }, { kind: 'invalidCredentials' }],
    ['403 PASSWORD_CAMBIO_REQUERIDO -> mustChangePassword', { status: 403, data: { code: 'PASSWORD_CAMBIO_REQUERIDO' } }, { kind: 'mustChangePassword' }],
    ['403 PASSWORD_CAMBIO_NO_REQUERIDO -> changeNotRequired', { status: 403, data: { code: 'PASSWORD_CAMBIO_NO_REQUERIDO' } }, { kind: 'changeNotRequired' }],
    ['403 VINCULO_NO_DISPONIBLE -> vinculoDisabled', { status: 403, data: { code: 'VINCULO_NO_DISPONIBLE' } }, { kind: 'vinculoDisabled' }],
    ['422 VINCULO_REQUERIDO -> vinculoRequired', { status: 422, data: { code: 'VINCULO_REQUERIDO' } }, { kind: 'vinculoRequired' }],
    ['422 VINCULO_FALTANTE sintético -> vinculoRequired', { status: 422, data: { code: 'VINCULO_FALTANTE' } }, { kind: 'vinculoRequired' }],
    [
      '422 errors.code -> validation',
      { status: 422, data: { message: 'x', errors: { code: ['Código inválido'] } } },
      { kind: 'validation', fields: { code: ['Código inválido'] } },
    ],
    ['sin respuesta -> network', { status: null, data: undefined }, { kind: 'network' }],
  ] satisfies [string, Partial<ErrorCrudo>, object][])('%s', (_nombre, entrada, esperado) => {
    expect(clasificarErrorPro(crudo(entrada))).toEqual(esperado);
  });

  it.each([500, 502, 503, 400, 405])('un %i genérico es server (nunca logout)', (status) => {
    expect(clasificarErrorPro(crudo({ status, data: { message: 'boom' } }))).toEqual({ kind: 'server' });
  });

  it('un 422 sin errors ni code conocido es validation sin campos', () => {
    expect(clasificarErrorPro(crudo({ status: 422, data: { message: 'x' } }))).toEqual({ kind: 'validation', fields: {} });
  });

  it('un 422 descarta del errors lo que no sea lista de strings', () => {
    const r = clasificarErrorPro(crudo({ status: 422, data: { errors: { password: ['corto', 7], email: 'mal', otro: [] } } }));
    expect(r).toEqual({ kind: 'validation', fields: { password: ['corto'] } });
  });

  it('un 401 en forgot/reset no es sesión vencida ni credenciales: es server', () => {
    expect(clasificarErrorPro(crudo({ status: 401, url: '/pro/forgot-password' }))).toEqual({ kind: 'server' });
    expect(clasificarErrorPro(crudo({ status: 401, url: '/pro/reset-password' }))).toEqual({ kind: 'server' });
  });
});

describe('clasificarErrorPro — 403 de suscripción (decide el code, nunca el texto)', () => {
  it.each([
    ['Suscripción vencida', 'NO_SUBSCRIPTION'],
    ['Suscripción suspendida', 'SUBSCRIPTION_SUSPENDED'],
    ['Suscripción vencida', 'SUBSCRIPTION_EXPIRED'],
  ])('403 "%s" con code %s -> noService con ese motivo', (error, code) => {
    expect(clasificarErrorPro(crudo({ status: 403, data: { error, code } }))).toEqual({ kind: 'noService', motivo: code });
  });

  it('el texto en español no influye: mismo code, otro texto', () => {
    const r = clasificarErrorPro(crudo({ status: 403, data: { error: 'Cualquier cosa', code: 'SUBSCRIPTION_SUSPENDED' } }));
    expect(r).toEqual({ kind: 'noService', motivo: 'SUBSCRIPTION_SUSPENDED' });
  });

  it('el texto "Suscripción vencida" sin code NO es noService', () => {
    expect(clasificarErrorPro(crudo({ status: 403, data: { error: 'Suscripción vencida' } }))).toEqual({ kind: 'server' });
  });

  it('un 403 con code desconocido es server (no noService)', () => {
    expect(clasificarErrorPro(crudo({ status: 403, data: { error: 'x', code: 'OTRA_COSA' } }))).toEqual({ kind: 'server' });
  });

  it('un 403 sin code (habilidad de Sanctum del token restringido) es server', () => {
    expect(clasificarErrorPro(crudo({ status: 403, data: { message: 'Invalid ability provided.' }, url: '/pro/me' }))).toEqual({ kind: 'server' });
    expect(clasificarErrorPro(crudo({ status: 403, data: null }))).toEqual({ kind: 'server' });
  });
});

describe('clasificarErrorPro — 429', () => {
  it('retry_after del cuerpo gana y marca lockout', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: { message: 'x', retry_after: 90 }, retryAfterHeader: '30' }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 90, lockout: true });
  });

  it('sin cuerpo usa el header Retry-After (sin lockout)', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: '', retryAfterHeader: '30' }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 30, lockout: false });
  });

  it('sin cuerpo ni header: segundos null', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: undefined }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: null, lockout: false });
  });
});

describe('clasificarErrorPro — robustez', () => {
  it('una clave __proto__ en errors no corrompe el objeto de campos', () => {
    const data = JSON.parse('{"errors":{"__proto__":["x"],"password":["corto"]}}');

    const r = clasificarErrorPro(crudo({ status: 422, data }));

    if (r.kind !== 'validation') throw new Error('se esperaba validation');
    expect(Array.isArray(Object.getPrototypeOf(r.fields))).toBe(false);
    expect(Object.getPrototypeOf(r.fields)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(r.fields, '__proto__')).toBe(true);
    expect(r.fields.password).toEqual(['corto']);
  });

  it('no depende de Object.hasOwn (iOS Safari viejo)', () => {
    const espia = vi.spyOn(Object, 'hasOwn').mockImplementation(() => {
      throw new TypeError('Object.hasOwn no existe');
    });
    try {
      expect(clasificarErrorPro(crudo({ status: 403, data: { code: 'VINCULO_NO_DISPONIBLE' } }))).toEqual({ kind: 'vinculoDisabled' });
      expect(clasificarErrorPro(crudo({ status: 403, data: { code: 'constructor' } }))).toEqual({ kind: 'server' });
    } finally {
      espia.mockRestore();
    }
  });
});

describe('clasificarErrorPro — 429 por la ruta real de parseRetryAfter', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('header con fecha HTTP: segundos hasta esa fecha, sin lockout', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: '', retryAfterHeader: 'Sat, 17 Oct 2026 12:02:00 GMT' }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 120, lockout: false });
  });

  it('header basura -> null', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: '', retryAfterHeader: 'foo 5' }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: null, lockout: false });
  });

  it('header con dígitos gigantes se recorta a 24 h', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: '', retryAfterHeader: '1' + '0'.repeat(20) }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 86400, lockout: false });
  });

  it('retry_after 1.5 en el cuerpo no es válido: cae al header y no marca lockout', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: { retry_after: 1.5 }, retryAfterHeader: '30' }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 30, lockout: false });
  });

  it('retry_after enorme en el cuerpo se recorta a 24 h y mantiene lockout', () => {
    const r = clasificarErrorPro(crudo({ status: 429, data: { retry_after: 999999 } }));
    expect(r).toEqual({ kind: 'rateLimited', retryAfterSec: 86400, lockout: true });
  });
});

describe('parseRetryAfter — acotado', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');

  it.each([
    ['-5', null],
    ['foo 5', null],
    ['5 segundos', null],
    ['1.5', null],
    ['+5', null],
    ['2026-10-17T12:01:00Z', null],
    ['Sat 17 Oct 2026 12:01:00', null],
  ])('el header %j se descarta (null, no 0)', (header, esperado) => {
    expect(parseRetryAfter(undefined, header, ahora)).toBe(esperado);
  });

  it('tope de 24 h en delta, fecha HTTP y cuerpo', () => {
    expect(parseRetryAfter(undefined, '86400', ahora)).toBe(86400);
    expect(parseRetryAfter(undefined, '86401', ahora)).toBe(86400);
    expect(parseRetryAfter(undefined, '9'.repeat(30), ahora)).toBe(86400);
    expect(parseRetryAfter(undefined, 'Wed, 17 Oct 2035 12:00:00 GMT', ahora)).toBe(86400);
    expect(parseRetryAfter({ retry_after: 10 ** 9 }, null, ahora)).toBe(86400);
  });
});

describe('parseRetryAfter', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');

  it('el cuerpo (entero o string numérico) gana sobre el header', () => {
    expect(parseRetryAfter({ retry_after: 90 }, '30', ahora)).toBe(90);
    expect(parseRetryAfter({ retry_after: '45' }, null, ahora)).toBe(45);
  });

  it('segundos delta del header', () => {
    expect(parseRetryAfter(undefined, '30', ahora)).toBe(30);
    expect(parseRetryAfter(undefined, ' 0 ', ahora)).toBe(0);
  });

  it('fecha HTTP del header: segundos hasta esa fecha', () => {
    expect(parseRetryAfter(undefined, 'Sat, 17 Oct 2026 12:01:30 GMT', ahora)).toBe(90);
  });

  it('fecha HTTP en el pasado se recorta a 0', () => {
    expect(parseRetryAfter(undefined, 'Sat, 17 Oct 2026 11:00:00 GMT', ahora)).toBe(0);
  });

  it.each([
    [{ retry_after: -5 }, null],
    [{ retry_after: 'abc' }, null],
    [{ retry_after: 1.5 }, null],
    [{ retry_after: Number.NaN }, null],
    ['texto', null],
    [null, null],
  ])('cuerpo inválido %j sin header -> null', (cuerpo, esperado) => {
    expect(parseRetryAfter(cuerpo, null, ahora)).toBe(esperado);
  });

  it('un header basura -> null', () => {
    expect(parseRetryAfter(undefined, 'pronto', ahora)).toBeNull();
    expect(parseRetryAfter(undefined, '', ahora)).toBeNull();
  });
});
