import axios, { AxiosError, AxiosHeaders, type RawAxiosHeaders } from 'axios';
import { clasificarErrorPro, type ErrorCrudo, type ProError } from '@/lib/pro/errores';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';

// Instancia de Axios completamente separada de lib/api.ts (la del tenant) y de
// lib/adminApi.ts. El portal vive en su propio origen
// (profesionales.turnetto.com), así que sus keys de storage no pueden chocar
// con las del salón; lo que se aísla acá son los interceptores, los eventos y
// el estado: un interceptor compartido haría que un 401 del portal abriera el
// modal de sesión terminada del salón (o al revés). Esta instancia solo lee
// `pro_token` y solo emite eventos propios; nunca importa lib/api.ts ni toca
// stores o eventos del tenant.
//
// Mismo timeout que lib/api.ts: un request colgado en mala señal debe fallar
// (y mostrarse como error de red) en vez de dejar el spinner para siempre.
const proApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
  // El Bearer nunca debe salir hacia otro origen: sin esto una URL absoluta o
  // '//host' ignoraría baseURL y el interceptor le adjuntaría el token.
  allowAbsoluteUrls: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export const EVENTO_SESION_EXPIRADA = 'pro-session-expired';
export const EVENTO_PORTAL_NO_DISPONIBLE = 'pro-portal-unavailable';

export const HEADER_VINCULO = 'X-Vinculo-Id';

// Rutas que el backend scopea por vínculo (middleware RequiereProfesionalVigente):
// turnos (incluye marcas y detalle) y servicios. Se evalúa sobre la ruta sin
// query. Cada llamada pasa el id EXPLÍCITO (no hay un "vínculo activo" global
// que leer): así un response tardío de un negocio anterior se puede descartar.
const RUTA_CON_VINCULO = /^\/?pro\/(turnos|servicios)(\/|$)/;

// Rutas cuyo cuerpo lleva contraseñas o el código de recuperación.
const RUTA_CON_CREDENCIALES = /^\/?pro\/(login|cambiar-password|forgot-password|reset-password)$/;

// Mismo formato que valida el backend; todo lo demás es un error de programación.
const VINCULO_VALIDO = /^[1-9]\d{0,17}$/;

type ProAxiosError = AxiosError & { proError?: ProError };

function rutaSinQuery(url: string | undefined): string {
  return (url ?? '').split(/[?#]/)[0];
}

// Mismo criterio que lib/api.ts: localStorage puede tirar (modo privado de iOS
// Safari, storage deshabilitado) — sin el try/catch, esa excepción rompe la
// request entera y un fallo de storage se confunde con un login inválido.
function leerToken(): string | null {
  try {
    return localStorage.getItem(PRO_STORAGE_KEYS.token);
  } catch {
    // sin acceso a localStorage — seguimos sin el header de auth en vez de romper la request
    return null;
  }
}

// URL absoluta ('https://x', 'HTTP://x') o relativa al protocolo ('//x').
const URL_ABSOLUTA = /^([a-z][a-z\d+.-]*:)?\/\//i;

proApi.interceptors.request.use((config) => {
  // Defensa en profundidad además de allowAbsoluteUrls: se corta ANTES de
  // adjuntar el token. Error de programación, no sale a la red.
  if (URL_ABSOLUTA.test(config.url ?? '')) {
    throw new AxiosError('URL absoluta no permitida', AxiosError.ERR_BAD_REQUEST, config, null, {
      status: 400,
      statusText: '',
      data: { code: 'URL_NO_PERMITIDA' },
      headers: {},
      config,
    });
  }

  const token = leerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (RUTA_CON_VINCULO.test(rutaSinQuery(config.url))) {
    const vinculo = String(config.headers.get(HEADER_VINCULO) ?? '');
    if (!VINCULO_VALIDO.test(vinculo)) {
      // Error de programación: el servicio olvidó el id. No sale a la red; se
      // clasifica como 422 sintético (vinculoRequired) en el interceptor de
      // respuesta, que es por donde pasa todo rechazo.
      throw new AxiosError(`Falta ${HEADER_VINCULO}`, AxiosError.ERR_BAD_REQUEST, config, null, {
        status: 422,
        statusText: '',
        data: { code: 'VINCULO_FALTANTE' },
        headers: {},
        config,
      });
    }
  } else {
    // Allowlist: el header solo viaja en las rutas de datos.
    config.headers.delete(HEADER_VINCULO);
  }
  return config;
});

function retryAfterDe(headers: object | undefined): string | null {
  if (!headers) return null;
  const valor = AxiosHeaders.from(headers as RawAxiosHeaders).get('Retry-After');
  return typeof valor === 'string' ? valor : null;
}

function desdeAxios(error: AxiosError): ErrorCrudo {
  return {
    status: error.response?.status ?? null,
    data: error.response?.data,
    retryAfterHeader: retryAfterDe(error.response?.headers),
    url: error.config?.url ?? '',
  };
}

// Un solo clasificador decide todo: sessionRevoked ya excluye login/forgot/
// reset (ahí un 401 son credenciales malas, no una sesión que reautenticar),
// así que el evento nunca sale desde esas pantallas. Las pantallas mapean el
// `kind` a copy i18n; nunca muestran el `message` del backend.
proApi.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Un pedido cancelado a propósito (AbortController) no es un error de red.
    if (axios.isCancel(error) || !axios.isAxiosError(error)) return Promise.reject(error);

    const proError = clasificarErrorPro(desdeAxios(error));
    (error as ProAxiosError).proError = proError;

    if (typeof window !== 'undefined') {
      if (proError.kind === 'sessionRevoked') {
        // Un 401 tardío de una sesión vieja (logout + login mientras el request
        // viajaba) no debe cerrar la nueva: solo cuenta si el token con el que
        // salió es el que sigue guardado.
        const enviado = error.config?.headers?.get('Authorization');
        const guardado = leerToken();
        const esDeLaSesionActual = (typeof enviado === 'string' ? enviado : null) === (guardado ? `Bearer ${guardado}` : null);
        if (esDeLaSesionActual) window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
      } else if (proError.kind === 'portalUnavailable') {
        window.dispatchEvent(new CustomEvent(EVENTO_PORTAL_NO_DISPONIBLE));
      }
    }

    // El error rechazado viaja a console.error / telemetría: no debe llevar el token...
    error.config?.headers?.delete('Authorization');
    // ...ni la contraseña (o el código de recuperación) que iba en el cuerpo.
    if (error.config && RUTA_CON_CREDENCIALES.test(rutaSinQuery(error.config.url))) {
      error.config.data = undefined;
    }
    return Promise.reject(error);
  },
);

// Error clasificado de un rechazo de proApi. Un valor que no pasó por el
// interceptor (cancelación, bug) se trata como `server`, nunca como logout.
export function proErrorDe(error: unknown): ProError {
  const proError = (error as ProAxiosError | null)?.proError;
  return proError ?? { kind: 'server' };
}

export default proApi;
