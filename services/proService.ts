import proApi from '@/lib/proApi';
import { parseListaTurnos, parseMarcas, parseProMe, parseProTurno, parseServicios } from '@/lib/pro/parsers';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import type { ProError } from '@/lib/pro/errores';
import type { ProListaTurnos, ProMarcas, ProMe, ProServicios, ProTurno } from '@/lib/pro/tipos';

// Servicio del portal de profesionales: una función por endpoint de
// `/api/pro/*`, solo lectura salvo la autenticación (G1). Usa SIEMPRE proApi
// (nunca lib/api.ts) y devuelve datos ya pasados por los parsers de lista
// blanca.
//
// Las URLs de acá no son un detalle: lib/pro/errores.ts clasifica un 401 por el
// FINAL de la URL (/pro/login = credenciales; /pro/forgot-password y
// /pro/reset-password = no es una sesión vencida) y lib/proApi.ts manda
// X-Vinculo-Id por el PREFIJO (/pro/turnos, /pro/servicios). El contrato de
// services/proService.test.ts fija cada una.

export type TipoSesion = 'full' | 'restricted';

export interface ProSesion {
  token: string;
  tipo: TipoSesion;
  // Instante de vencimiento en ms; null si el backend no mandó uno legible.
  expiresAt: number | null;
}

export type LecturaSesion =
  | { estado: 'ninguna' }
  | { estado: 'expirada' }
  | { estado: 'vigente'; sesion: ProSesion & { expiresAt: number } };

// `fecha` y `desde`/`hasta` son excluyentes (el backend responde 422 si llegan
// los dos); `buscar` y `servicio_id` acompañan a cualquiera de los dos modos.
export type FiltrosTurnos = (
  | { fecha: string; desde?: undefined; hasta?: undefined }
  | { fecha?: undefined; desde: string; hasta: string }
) & { buscar?: string; servicio_id?: number };

export interface DatosResetPassword {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
}

// Errores generados acá (sin pasar por la red) llevan el mismo `proError` que
// los rechazos de proApi, para que el llamador use `proErrorDe`.
function errorLocal(mensaje: string, proError: ProError): Error & { proError: ProError } {
  return Object.assign(new Error(mensaje), { proError });
}

// Una respuesta 200 que no tiene la forma del contrato (cuerpo de error JSON,
// HTML de un portal cautivo...) es un fallo del servidor: nunca una sesión, un
// dato a medias ni una lista vacía que se confunda con "sin turnos".
function respuestaInvalida(que: string): Error & { proError: ProError } {
  return errorLocal(`Respuesta inválida del portal: ${que}`, { kind: 'server' });
}

function filtroInvalido(campo: string): Error & { proError: ProError } {
  return errorLocal(`Filtro inválido: ${campo}`, { kind: 'validation', fields: { [campo]: ['FILTRO_INVALIDO'] } });
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function sesionDeRespuesta(data: unknown): ProSesion {
  if (!esObjeto(data) || typeof data.token !== 'string' || data.token === '') {
    throw respuestaInvalida('sin token');
  }
  // El token restringido (cambio de contraseña pendiente) nunca se deriva de
  // `me`: viaja y se persiste con la sesión. Si el flag no es un booleano no se
  // adivina el tipo.
  if (typeof data.debe_cambiar_password !== 'boolean') {
    throw respuestaInvalida('debe_cambiar_password');
  }
  return {
    token: data.token,
    tipo: data.debe_cambiar_password ? 'restricted' : 'full',
    expiresAt: instanteDe(data.expires_at),
  };
}

// Sufijo de zona obligatorio: un ISO sin zona se leería como hora LOCAL del
// dispositivo y correría el vencimiento. El backend manda UTC ("...Z").
const CON_ZONA = /(Z|[+-]\d{2}:?\d{2})$/i;

function instanteDe(valor: unknown): number | null {
  if (typeof valor !== 'string' || !CON_ZONA.test(valor)) return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
}

// Header explícito por llamada (no hay un "vínculo activo" global): un
// response tardío del negocio anterior se puede reconocer y descartar.
function conVinculo(vinculoId: number, signal?: AbortSignal) {
  return { headers: { 'X-Vinculo-Id': String(vinculoId) }, signal };
}

// Texto presente (no undefined/null/vacío/solo espacios) o undefined. Un valor
// vacío NO se manda: el backend lo leería como un filtro vacío inválido.
function textoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const recortado = valor.trim();
  return recortado === '' ? undefined : recortado;
}

// Arma el query de GET /pro/turnos y falla ANTES de la red ante combinaciones
// que el backend rechazaría con 422: `fecha` junto con `desde`/`hasta`, o un
// extremo del rango sin el otro. Sin ninguna fecha es válido (el backend usa hoy).
function paramsDeTurnos(filtros: FiltrosTurnos): Record<string, string | number> {
  const fecha = textoOpcional(filtros.fecha);
  const desde = textoOpcional(filtros.desde);
  const hasta = textoOpcional(filtros.hasta);
  const buscar = textoOpcional(filtros.buscar);

  if (fecha !== undefined && (desde !== undefined || hasta !== undefined)) throw filtroInvalido('fecha');
  if (desde !== undefined && hasta === undefined) throw filtroInvalido('hasta');
  if (hasta !== undefined && desde === undefined) throw filtroInvalido('desde');

  const params: Record<string, string | number> = {};
  if (fecha !== undefined) params.fecha = fecha;
  if (desde !== undefined) params.desde = desde;
  if (hasta !== undefined) params.hasta = hasta;
  if (buscar !== undefined) params.buscar = buscar;

  const servicioId: unknown = filtros.servicio_id;
  if (servicioId !== undefined && servicioId !== null && servicioId !== '') {
    if (typeof servicioId !== 'number' || !Number.isSafeInteger(servicioId) || servicioId <= 0) {
      throw filtroInvalido('servicio_id');
    }
    params.servicio_id = servicioId;
  }
  return params;
}

// localStorage puede tirar (modo privado de iOS Safari, storage deshabilitado):
// sin el try/catch un fallo de storage rompería el arranque del portal.
function leerClave(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

const CLAVES_SESION = [PRO_STORAGE_KEYS.token, PRO_STORAGE_KEYS.tipo, PRO_STORAGE_KEYS.expiresAt];

function borrarSesion(): void {
  // No toca `pro_ultimo_vinculo` (default del próximo arranque, no es sesión)
  // ni ninguna key del tenant o del admin.
  for (const clave of CLAVES_SESION) {
    try {
      localStorage.removeItem(clave);
    } catch {
      // sin acceso a localStorage — no hay nada que limpiar
    }
  }
}

// ATÓMICO: si cualquier escritura falla se borra todo lo de la sesión y se
// devuelve false, para que nunca quede un token nuevo junto a un tipo o un
// vencimiento viejos (p. ej. un token full con el tipo restricted de antes). El
// llamador no debe dar por iniciada una sesión que proApi (que lee el token de
// localStorage) no podría usar.
function guardarSesion(sesion: ProSesion): boolean {
  try {
    localStorage.setItem(PRO_STORAGE_KEYS.token, sesion.token);
    localStorage.setItem(PRO_STORAGE_KEYS.tipo, sesion.tipo);
    if (sesion.expiresAt === null) {
      // Sin vencimiento legible la sesión no es restaurable: al recargar se
      // trata como inexistente (falla cerrado, SE-4 S5).
      localStorage.removeItem(PRO_STORAGE_KEYS.expiresAt);
    } else {
      localStorage.setItem(PRO_STORAGE_KEYS.expiresAt, String(sesion.expiresAt));
    }
    return true;
  } catch {
    borrarSesion();
    return false;
  }
}

// Lee la sesión guardada SIN red. Falla cerrado: cualquier dato ausente o
// corrupto es "ninguna" (y se limpia lo que quedó); una sesión vencida se
// borra y se informa como "expirada" para que el login muestre el aviso.
//
// Reloj del dispositivo: el vencimiento se compara contra el reloj local, sin
// corrección de skew. Un reloj adelantado vence la sesión antes de tiempo (la
// persona vuelve a loguearse); uno atrasado la deja "vigente" de más, pero el
// backend sigue siendo la autoridad: un token vencido recibe 401 y proApi
// emite pro-session-expired.
function leerSesion(ahoraMs: number = Date.now()): LecturaSesion {
  const lectura = peekSesion(ahoraMs);
  if (lectura.estado !== 'vigente') borrarSesion();
  return lectura;
}

// La misma lectura pero de SOLO LECTURA: no borra nada. Es la que usa la
// sincronización entre pestañas: guardarSesion de otra pestaña escribe token,
// tipo y vencimiento de a uno (y cada setItem dispara un evento `storage`), así
// que un estado a medias es normal y borrarlo destruiría la sesión nueva. Solo
// el arranque (leerSesion) limpia datos corruptos o vencidos.
function peekSesion(ahoraMs: number = Date.now()): LecturaSesion {
  const token = leerClave(PRO_STORAGE_KEYS.token);
  const tipo = leerClave(PRO_STORAGE_KEYS.tipo);
  const crudoExpira = leerClave(PRO_STORAGE_KEYS.expiresAt);

  const expiresAt = crudoExpira !== null && /^\d+$/.test(crudoExpira) ? Number(crudoExpira) : Number.NaN;
  const tipoValido = tipo === 'full' || tipo === 'restricted';

  if (!token || !tipoValido || !Number.isSafeInteger(expiresAt)) return { estado: 'ninguna' };
  if (expiresAt <= ahoraMs) return { estado: 'expirada' };
  return { estado: 'vigente', sesion: { token, tipo, expiresAt } };
}

export const proService = {
  // ── Autenticación ────────────────────────────────────────────────────────
  // `dispositivo` (opcional en el backend) se omite a propósito.
  async login(email: string, password: string): Promise<ProSesion> {
    const response = await proApi.post<unknown>('/pro/login', { email, password });
    return sesionDeRespuesta(response.data);
  },

  async cambiarPassword(password: string, confirmacion: string): Promise<ProSesion> {
    const response = await proApi.post<unknown>('/pro/cambiar-password', {
      password,
      password_confirmation: confirmacion,
    });
    return sesionDeRespuesta(response.data);
  },

  async forgotPassword(email: string): Promise<void> {
    await proApi.post('/pro/forgot-password', { email });
  },

  // Campos explícitos: lo que el llamador agregue de más no viaja.
  async resetPassword(datos: DatosResetPassword): Promise<void> {
    await proApi.post('/pro/reset-password', {
      email: datos.email,
      code: datos.code,
      password: datos.password,
      password_confirmation: datos.password_confirmation,
    });
  },

  async logout(): Promise<void> {
    await proApi.post('/pro/logout');
  },

  async me(): Promise<ProMe> {
    const response = await proApi.get<unknown>('/pro/me');
    const me = parseProMe(response.data);
    if (me === null) throw respuestaInvalida('me');
    return me;
  },

  // ── Datos del negocio elegido (siempre con X-Vinculo-Id explícito) ───────
  async turnos(vinculoId: number, filtros: FiltrosTurnos, signal?: AbortSignal): Promise<ProListaTurnos> {
    const params = paramsDeTurnos(filtros);
    const response = await proApi.get<unknown>('/pro/turnos', { params, ...conVinculo(vinculoId, signal) });
    const lista = parseListaTurnos(response.data);
    if (lista === null) throw respuestaInvalida('turnos');
    return lista;
  },

  // `mes` es "YYYY-MM".
  async marcas(vinculoId: number, mes: string, signal?: AbortSignal): Promise<ProMarcas> {
    const response = await proApi.get<unknown>('/pro/turnos/marcas', {
      params: { mes },
      ...conVinculo(vinculoId, signal),
    });
    const marcas = parseMarcas(response.data);
    if (marcas === null) throw respuestaInvalida('marcas');
    return marcas;
  },

  // El id va en la ruta SIN encoding: la compuerta de entero seguro positivo
  // garantiza que son solo dígitos (un encodeURIComponent sería código muerto) y
  // evita que un valor ajeno ("5/../me", "41?x=1") cambie la ruta pedida. Un id
  // inválido no sale a la red: para el llamador es un turno inexistente.
  async turno(vinculoId: number, id: number, signal?: AbortSignal): Promise<ProTurno> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw errorLocal('Id de turno inválido', { kind: 'notFound' });
    }
    const response = await proApi.get<unknown>(`/pro/turnos/${id}`, conVinculo(vinculoId, signal));
    const turno = parseProTurno(response.data);
    if (turno === null) throw respuestaInvalida('turno');
    return turno;
  },

  async servicios(vinculoId: number, signal?: AbortSignal): Promise<ProServicios> {
    const response = await proApi.get<unknown>('/pro/servicios', conVinculo(vinculoId, signal));
    const servicios = parseServicios(response.data);
    if (servicios === null) throw respuestaInvalida('servicios');
    return servicios;
  },

  // ── Sesión guardada ──────────────────────────────────────────────────────
  guardarSesion,
  leerSesion,
  peekSesion,
  borrarSesion,
};
