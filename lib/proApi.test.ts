import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import proApi, { proErrorDe } from './proApi';

const adapterOriginal = proApi.defaults.adapter;

let configsEnviadas: InternalAxiosRequestConfig[];

function responderOk() {
  proApi.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    configsEnviadas.push(config);
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  };
}

function responderCon(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  proApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    configsEnviadas.push(config);
    return Promise.reject(
      new AxiosError('fallo', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', data, headers, config }),
    );
  };
}

function sinRespuesta() {
  proApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    configsEnviadas.push(config);
    return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config, null, undefined));
  };
}

const EVENTOS_AJENOS = ['session-expired', 'admin-session-expired', 'auth:session-revoked', 'auth:subscription-suspect'];

let sesionExpirada: ReturnType<typeof vi.fn>;
let portalNoDisponible: ReturnType<typeof vi.fn>;
let ajenos: ReturnType<typeof vi.fn>;

beforeEach(() => {
  configsEnviadas = [];
  localStorage.clear();
  sesionExpirada = vi.fn();
  portalNoDisponible = vi.fn();
  ajenos = vi.fn();
  window.addEventListener('pro-session-expired', sesionExpirada);
  window.addEventListener('pro-portal-unavailable', portalNoDisponible);
  EVENTOS_AJENOS.forEach((e) => window.addEventListener(e, ajenos));
});

afterEach(() => {
  window.removeEventListener('pro-session-expired', sesionExpirada);
  window.removeEventListener('pro-portal-unavailable', portalNoDisponible);
  EVENTOS_AJENOS.forEach((e) => window.removeEventListener(e, ajenos));
  proApi.defaults.adapter = adapterOriginal;
  localStorage.clear();
});

describe('proApi — instancia propia', () => {
  // No se importa lib/api acá: el portal no debe tocar la instancia del tenant
  // ni siquiera desde sus tests (la prueba de aislamiento llega con P3b).
  it('no es la instancia del admin y tiene timeout', async () => {
    const { default: adminApi } = await import('./adminApi');
    expect(proApi).not.toBe(adminApi);
    expect(proApi.defaults.timeout).toBe(15000);
  });
});

describe('proApi — Authorization (SE-1)', () => {
  it('adjunta el Bearer del pro_token', async () => {
    localStorage.setItem('pro_token', 'tok-pro');
    responderOk();

    await proApi.get('/pro/me');

    expect(configsEnviadas[0].headers.get('Authorization')).toBe('Bearer tok-pro');
  });

  it('nunca manda el token del tenant ni el del admin', async () => {
    localStorage.setItem('auth_token', 'tok-tenant');
    localStorage.setItem('admin_token', 'tok-admin');
    responderOk();

    await proApi.get('/pro/me');

    expect(configsEnviadas[0].headers.get('Authorization')).toBeFalsy();
  });

  it('si localStorage tira, la request sale igual sin Authorization', async () => {
    const espia = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage deshabilitado');
    });
    responderOk();

    await expect(proApi.get('/pro/me')).resolves.toBeDefined();
    espia.mockRestore();

    expect(configsEnviadas[0].headers.get('Authorization')).toBeFalsy();
  });
});

describe('proApi — eventos (SE-1 S3)', () => {
  it('un 401 en un request autenticado dispara pro-session-expired y ningún evento ajeno', async () => {
    responderCon(401, { message: 'Unauthenticated.' });

    await expect(proApi.get('/pro/me')).rejects.toBeInstanceOf(AxiosError);

    expect(sesionExpirada).toHaveBeenCalledTimes(1);
    expect(ajenos).not.toHaveBeenCalled();
  });

  it.each(['/pro/login', '/pro/login/', '/pro/login?x=1', '/pro/forgot-password', '/pro/reset-password'])(
    'un 401 en %s NO dispara pro-session-expired',
    async (url) => {
      responderCon(401, { message: 'Unauthenticated.' });

      await expect(proApi.post(url, {})).rejects.toBeInstanceOf(AxiosError);

      expect(sesionExpirada).not.toHaveBeenCalled();
      expect(ajenos).not.toHaveBeenCalled();
    },
  );

  it('un 401 en /pro/logout sí dispara el evento (no se confunde con el login)', async () => {
    responderCon(401, { message: 'Unauthenticated.' });

    await expect(proApi.post('/pro/logout')).rejects.toBeInstanceOf(AxiosError);

    expect(sesionExpirada).toHaveBeenCalledTimes(1);
  });

  it('un 404 dispara pro-portal-unavailable', async () => {
    responderCon(404, { message: 'Not Found' });

    await expect(proApi.post('/pro/login', {})).rejects.toBeInstanceOf(AxiosError);

    expect(portalNoDisponible).toHaveBeenCalledTimes(1);
    expect(sesionExpirada).not.toHaveBeenCalled();
    expect(ajenos).not.toHaveBeenCalled();
  });

  it('un 404 TURNO_NO_ENCONTRADO no dispara pro-portal-unavailable', async () => {
    responderCon(404, { code: 'TURNO_NO_ENCONTRADO' });

    await expect(proApi.get('/pro/turnos/7', { headers: { 'X-Vinculo-Id': '3' } })).rejects.toBeInstanceOf(AxiosError);

    expect(portalNoDisponible).not.toHaveBeenCalled();
  });

  it.each([500, 429, 422, 403])('un %i no dispara ningún evento', async (status) => {
    responderCon(status, { message: 'x' });

    await expect(proApi.get('/pro/me')).rejects.toBeInstanceOf(AxiosError);

    expect(sesionExpirada).not.toHaveBeenCalled();
    expect(portalNoDisponible).not.toHaveBeenCalled();
    expect(ajenos).not.toHaveBeenCalled();
  });
});

describe('proApi — X-Vinculo-Id (SE-2)', () => {
  it.each([
    '/pro/turnos',
    '/pro/turnos?fecha=2026-10-17',
    'pro/turnos',
    '/pro/turnos/marcas',
    '/pro/turnos/marcas?mes=2026-10',
    '/pro/turnos/12',
    '/pro/servicios',
    '/pro/servicios?x=1',
  ])('se conserva en %s', async (url) => {
    responderOk();

    await proApi.get(url, { headers: { 'X-Vinculo-Id': '3' } });

    expect(configsEnviadas[0].headers.get('X-Vinculo-Id')).toBe('3');
  });

  it.each(['/pro/login', '/pro/me', '/pro/cambiar-password', '/pro/forgot-password', '/pro/reset-password', '/pro/logout'])(
    'se elimina en %s aunque venga seteado',
    async (url) => {
      responderOk();

      await proApi.post(url, {}, { headers: { 'X-Vinculo-Id': '3' } });

      expect(configsEnviadas[0].headers.get('X-Vinculo-Id')).toBeFalsy();
    },
  );

  it('una URL parecida pero no listada (turnos-extra) no cuenta como ruta con vínculo', async () => {
    responderOk();

    await proApi.get('/pro/turnos-extra', { headers: { 'X-Vinculo-Id': '3' } });

    expect(configsEnviadas[0].headers.get('X-Vinculo-Id')).toBeFalsy();
  });

  it('una ruta con vínculo sin header se rechaza sin salir a la red (VINCULO_FALTANTE)', async () => {
    responderOk();

    const error = await proApi.get('/pro/turnos').catch((e: unknown) => e);

    expect(configsEnviadas).toHaveLength(0);
    expect(proErrorDe(error)).toEqual({ kind: 'vinculoRequired' });
    expect(sesionExpirada).not.toHaveBeenCalled();
  });

  it.each(['', '0', '-1', 'abc', '01', '1234567890123456789'])(
    'un X-Vinculo-Id inválido (%j) se trata como faltante',
    async (valor) => {
      responderOk();

      const error = await proApi.get('/pro/servicios', { headers: { 'X-Vinculo-Id': valor } }).catch((e: unknown) => e);

      expect(configsEnviadas).toHaveLength(0);
      expect(proErrorDe(error)).toEqual({ kind: 'vinculoRequired' });
    },
  );
});

describe('proApi — err.proError', () => {
  it('adjunta el error clasificado al rechazo', async () => {
    responderCon(403, { error: 'Suscripción suspendida', code: 'SUBSCRIPTION_SUSPENDED' });

    const error = await proApi.get('/pro/servicios', { headers: { 'X-Vinculo-Id': '3' } }).catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'noService', motivo: 'SUBSCRIPTION_SUSPENDED' });
  });

  it('lee Retry-After del header de la respuesta', async () => {
    responderCon(429, '', { 'retry-after': '30' });

    const error = await proApi.post('/pro/forgot-password', {}).catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'rateLimited', retryAfterSec: 30, lockout: false });
  });

  it('el retry_after del cuerpo del login marca lockout', async () => {
    responderCon(429, { message: 'x', retry_after: 90 });

    const error = await proApi.post('/pro/login', {}).catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'rateLimited', retryAfterSec: 90, lockout: true });
  });

  it('sin respuesta es network y no dispara eventos', async () => {
    sinRespuesta();

    const error = await proApi.get('/pro/me').catch((e: unknown) => e);

    expect(proErrorDe(error)).toEqual({ kind: 'network' });
    expect(sesionExpirada).not.toHaveBeenCalled();
    expect(portalNoDisponible).not.toHaveBeenCalled();
  });

  it('un pedido cancelado a propósito no se clasifica como error de red', async () => {
    proApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      configsEnviadas.push(config);
      return Promise.reject(new axios.CanceledError('cancelado', config));
    };

    const error = await proApi.get('/pro/me').catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
    expect((error as { proError?: unknown }).proError).toBeUndefined();
  });
});

describe('proErrorDe', () => {
  it('un valor que no pasó por proApi es server', () => {
    expect(proErrorDe(new Error('x'))).toEqual({ kind: 'server' });
    expect(proErrorDe(null)).toEqual({ kind: 'server' });
  });
});
