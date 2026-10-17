// Clasificador puro de errores del portal de profesionales. No importa axios
// ni nada del tenant: recibe un ErrorCrudo y devuelve un ProError. Las
// pantallas mapean el `kind` a copy i18n y nunca muestran el `message` del
// backend.

export const MOTIVOS_VINCULO = ['NO_SUBSCRIPTION', 'SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_EXPIRED'] as const;
export type MotivoVinculo = (typeof MOTIVOS_VINCULO)[number];

export type ProError =
  | { kind: 'invalidCredentials' }
  | { kind: 'sessionRevoked' }
  | { kind: 'mustChangePassword' }
  | { kind: 'changeNotRequired' }
  | { kind: 'vinculoRequired' }
  | { kind: 'vinculoDisabled' }
  | { kind: 'noService'; motivo: MotivoVinculo | null }
  | { kind: 'notFound' }
  | { kind: 'portalUnavailable' }
  | { kind: 'rateLimited'; retryAfterSec: number | null; lockout: boolean }
  | { kind: 'validation'; fields: Record<string, string[]> }
  | { kind: 'network' }
  | { kind: 'server' };

export interface ErrorCrudo {
  status: number | null;
  data: unknown;
  retryAfterHeader: string | null;
  url: string;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function codigoDe(data: unknown): string | null {
  return esObjeto(data) && typeof data.code === 'string' ? data.code : null;
}

function rutaDe(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, '');
}

const esUrlDeLogin = (url: string): boolean => /(^|\/)pro\/login$/.test(rutaDe(url));

function esUrlSinSesion(url: string): boolean {
  return /(^|\/)pro\/(login|forgot-password|reset-password)$/.test(rutaDe(url));
}

// 403 con `code` conocido. Cualquier otro 403 (code desconocido, sin code, como
// el de habilidades de Sanctum del token restringido en `me`) NO es "sin
// servicio": cae a `server`. Solo los tres codes de suscripción confirmados en
// el backend son noService, y se decide por code, nunca por el texto.
const ERRORES_403: Readonly<Record<string, ProError>> = {
  PASSWORD_CAMBIO_REQUERIDO: { kind: 'mustChangePassword' },
  PASSWORD_CAMBIO_NO_REQUERIDO: { kind: 'changeNotRequired' },
  VINCULO_NO_DISPONIBLE: { kind: 'vinculoDisabled' },
  NO_SUBSCRIPTION: { kind: 'noService', motivo: 'NO_SUBSCRIPTION' },
  SUBSCRIPTION_SUSPENDED: { kind: 'noService', motivo: 'SUBSCRIPTION_SUSPENDED' },
  SUBSCRIPTION_EXPIRED: { kind: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' },
};

const SERVER: ProError = { kind: 'server' };

// Object.fromEntries define las claves como propias: un `__proto__` del
// backend (o de un cuerpo manipulado) queda como dato y no cambia el prototipo.
function camposDeValidacion(data: unknown): Record<string, string[]> {
  if (!esObjeto(data) || !esObjeto(data.errors)) return {};
  const entradas = Object.entries(data.errors).flatMap(([campo, valor]): [string, string[]][] => {
    if (!Array.isArray(valor)) return [];
    const mensajes = valor.filter((m): m is string => typeof m === 'string');
    return mensajes.length > 0 ? [[campo, mensajes]] : [];
  });
  return Object.fromEntries(entradas);
}

// Tope de espera que se le puede imponer a la persona: un Retry-After absurdo
// (o hostil) no debe dejar el botón bloqueado por días.
const MAX_RETRY_AFTER_SEC = 86400;

// Fecha HTTP en formato IMF-fixdate (RFC 7231), p. ej. "Sat, 17 Oct 2026 12:01:30 GMT".
// Se valida la forma ANTES de Date.parse, que es demasiado permisivo
// ("foo 5" o "-5" no deben terminar como 0 segundos).
const FECHA_HTTP = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function retryAfterDelCuerpo(body: unknown): number | null {
  if (!esObjeto(body)) return null;
  const crudo = body.retry_after;
  const n = typeof crudo === 'string' && /^\d+$/.test(crudo.trim()) ? Number(crudo) : crudo;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_RETRY_AFTER_SEC) : null;
}

function retryAfterDelHeader(header: string | null, ahoraMs: number): number | null {
  const valor = header?.trim() ?? '';
  if (/^\d+$/.test(valor)) return Math.min(Number(valor), MAX_RETRY_AFTER_SEC);
  if (!FECHA_HTTP.test(valor)) return null;
  const fecha = Date.parse(valor);
  if (Number.isNaN(fecha)) return null;
  return Math.min(Math.max(0, Math.ceil((fecha - ahoraMs) / 1000)), MAX_RETRY_AFTER_SEC);
}

// Segundos a esperar tras un 429: primero el cuerpo (`retry_after` del
// lockout del login), después el header `Retry-After` (delta-segundos o fecha
// HTTP, recortado a [0, 24 h]), si no null (copy sin segundos).
export function parseRetryAfter(body: unknown, header: string | null, ahoraMs: number = Date.now()): number | null {
  return retryAfterDelCuerpo(body) ?? retryAfterDelHeader(header, ahoraMs);
}

export function clasificarErrorPro(e: ErrorCrudo): ProError {
  const { status, data } = e;
  if (status === null) return { kind: 'network' };

  const code = codigoDe(data);
  switch (status) {
    case 401:
      if (esUrlDeLogin(e.url)) return { kind: 'invalidCredentials' };
      // Un 401 de forgot/reset no es una sesión vencida (no hay sesión).
      return esUrlSinSesion(e.url) ? SERVER : { kind: 'sessionRevoked' };
    case 403:
      // hasOwnProperty.call y no Object.hasOwn: iOS Safari viejo no lo tiene y
      // lanzaría dentro del interceptor.
      return (code !== null && Object.prototype.hasOwnProperty.call(ERRORES_403, code) ? ERRORES_403[code] : null) ?? SERVER;
    case 404:
      return code === 'TURNO_NO_ENCONTRADO' ? { kind: 'notFound' } : { kind: 'portalUnavailable' };
    case 422:
      if (code === 'VINCULO_REQUERIDO' || code === 'VINCULO_FALTANTE') return { kind: 'vinculoRequired' };
      return { kind: 'validation', fields: camposDeValidacion(data) };
    case 429:
      return {
        kind: 'rateLimited',
        retryAfterSec: parseRetryAfter(data, e.retryAfterHeader),
        // Solo el lockout del login trae retry_after en el cuerpo.
        lockout: retryAfterDelCuerpo(data) !== null,
      };
    default:
      return SERVER;
  }
}
