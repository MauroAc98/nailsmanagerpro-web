import api from '@/lib/api';
import type { Locale } from '@/lib/locale';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  slug: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  is_exempt: boolean;
  confirmacion_automatica: boolean;
  recordatorio_automatico: boolean;
  hora_recordatorio: string;
  sena_monto: number | null;
  // Opt-in por salón para pedir seña en la confirmación de WhatsApp
  // (plantilla `reserva_turno_sena`). Cuando es `true`, el backend exige
  // `sena_monto > 0`, `direccion`, `whatsapp_sena_titular` y (alias o CBU).
  // Apagarlo siempre se acepta y conserva los datos bancarios guardados.
  whatsapp_pide_sena: boolean;
  // Datos de la cuenta donde el cliente transfiere la seña. Se mandan a Meta
  // en una sola línea ({{8}}): el backend rechaza `\r\n\t` y colapsa los
  // espacios interiores; el front sanea igual antes de enviar. `entidad` y
  // `cbu` son opcionales por separado (alcanza con alias o CBU).
  whatsapp_sena_titular: string | null;
  whatsapp_sena_entidad: string | null;
  whatsapp_sena_alias: string | null;
  whatsapp_sena_cbu: string | null;
  debe_cambiar_password?: boolean;
  // true por cualquiera de estas razones: (a) la profesional no tiene
  // teléfono de contacto cargado, o (b) el ratio de mensajes de Cloud API
  // fallidos es alto en los últimos 30 días.
  whatsapp_requiere_envio_manual: boolean;
  // null = sin preferencia guardada en el backend (usuarios creados antes
  // de la Fase 0, o campo todavía no desplegado) → resolveLocale() cae a
  // 'es'. Ver spec "Unset resolves to es".
  locale: Locale | null;
  // null = todavía no subió un logo propio — el login (LoginScreen, por
  // slug) y el resto de la app caen al placeholder genérico.
  logo_url: string | null;
  // Listas custom de categorías de movimientos del salón. El backend las
  // manda SIEMPRE (nunca null): son la lista editada por la usuaria o el
  // set de fábrica (CATEGORIAS_GASTO / CATEGORIAS_INGRESO) si nunca la
  // tocó. Se editan por el mismo `PUT /perfil` que el resto del perfil
  // (updatePerfil acepta `Partial<User>`): 1..30 ítems, cada string
  // 1..40 chars, sin repetir — el backend normaliza trim + espacios
  // interiores y rechaza duplicados con 422.
  categorias_gasto: string[];
  categorias_ingreso: string[];
}

export interface NegocioBranding {
  nombre: string;
  logo_url: string | null;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface LoginDebeCambiarResponse {
  debe_cambiar_password: true;
  email: string;
  message: string;
}

export type LoginResult = LoginResponse | LoginDebeCambiarResponse;

export interface SupportInfo {
  whatsapp: string;
  email: string;
  subscription_warning_days: number;
}

// ─────────────────────────────────────────────
// Keys de localStorage
// ─────────────────────────────────────────────
const KEYS = {
  token: 'auth_token',
  user:  'auth_user',
  // Recordado en el dispositivo para la PWA instalada: el manifest tiene un
  // único start_url fijo ("/"), así que abrir la app desde el ícono siempre
  // aterriza en /login sin slug en la URL, sin importar por qué link se
  // instaló. Guardar el slug acá es lo único que sobrevive esa limitación.
  negocioSlug: 'negocio_slug',
};

// El email del flujo "debe cambiar contraseña" vive en sessionStorage (no
// localStorage): así sobrevive a un refresh accidental en /cambiar-password
// pero se limpia al cerrar la pestaña — no queremos dejar un email colgado
// para siempre si el usuario abandona el flujo. Mismo criterio que
// BIENVENIDA_KEY en useAuthStore.
const EMAIL_PENDIENTE_KEY = 'email_pendiente';

// ─────────────────────────────────────────────
// Wrappers seguros de localStorage — puede tirar en modo privado de iOS
// Safari (setItem con QuotaExceededError) o si el storage está deshabilitado.
// Sin esto, una excepción de storage se confundía con un fallo real de
// login/guardado (ej. "no se pudo iniciar sesión" con credenciales
// correctas). Mismo criterio que useThemeStore/useLocaleStore; se extrae
// acá porque este archivo tiene ~10 call sites en vez de 2-3.
// ─────────────────────────────────────────────
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sin acceso a localStorage — la sesión no persiste entre recargas, no bloqueamos
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // sin acceso a localStorage
  }
}

// Wrappers seguros de sessionStorage — mismo motivo que los de localStorage
// (modo privado de iOS Safari, storage deshabilitado).
function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sin acceso a sessionStorage — el flujo no sobrevive un refresh, no bloqueamos
  }
}

function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sin acceso a sessionStorage
  }
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const authService = {

  login: async (email: string, password: string): Promise<LoginResult> => {
    const response = await api.post<LoginResult>('/auth/login', { email, password });
    if ('debe_cambiar_password' in response.data) return response.data;
    safeSetItem(KEYS.token, response.data.token);
    safeSetItem(KEYS.user, JSON.stringify(response.data.user));
    return response.data;
  },

  cambiarPasswordObligatorio: async (data: {
    email: string;
    password_actual: string;
    password: string;
    password_confirmation: string;
  }): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/cambiar-password-obligatorio', data);
    safeSetItem(KEYS.token, response.data.token);
    safeSetItem(KEYS.user, JSON.stringify(response.data.user));
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      safeRemoveItem(KEYS.token);
      safeRemoveItem(KEYS.user);
    }
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  updatePerfil: async (data: Partial<User> & { password?: string; password_confirmation?: string }): Promise<User> => {
    const response = await api.put<User>('/perfil', data);
    safeSetItem(KEYS.user, JSON.stringify(response.data));
    return response.data;
  },

  // Multipart — mismo mecanismo que profesionalService.subirFotoHistoriaPrecios:
  // pisar 'Content-Type' a undefined para que axios arme el multipart con su
  // propio boundary en vez de serializar el FormData como JSON (la instancia
  // `api` fija 'application/json' por default en todos los requests).
  subirLogo: async (archivo: File): Promise<User> => {
    const form = new FormData();
    form.append('imagen', archivo);
    const response = await api.post<User>('/perfil/logo', form, {
      headers: { 'Content-Type': undefined },
      // La instancia `api` tiene un timeout default de 15s (lib/api.ts) —
      // corto para subir un logo de varios MB desde un celular con mala señal.
      timeout: 60_000,
    });
    safeSetItem(KEYS.user, JSON.stringify(response.data));
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: {
    email: string;
    code: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  },

  getSupportInfo: async (): Promise<SupportInfo> => {
    const response = await api.get<SupportInfo>('/support-info');
    return response.data;
  },

  // Público (sin auth) — usado por LoginScreen cuando entran por
  // /login/{slug} para mostrar el logo del negocio antes de autenticarse.
  // 404 (slug inexistente) se resuelve a null en vez de propagar: es una
  // ruta de personalización best-effort, nunca debe romper el login.
  obtenerBrandingNegocio: async (slug: string): Promise<NegocioBranding | null> => {
    try {
      const response = await api.get<NegocioBranding>(`/public/${slug}/branding`);
      return response.data;
    } catch {
      return null;
    }
  },

  // ─────────────────────────────────────────────
  // Helpers de storage — síncronos en web
  // ─────────────────────────────────────────────
  getToken: (): string | null => safeGetItem(KEYS.token),

  getUsuarioGuardado: (): User | null => {
    const raw = safeGetItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  },

  estaAutenticado: (): boolean => !!safeGetItem(KEYS.token),

  // Ver comentario en KEYS.negocioSlug — respaldo para la PWA instalada.
  guardarSlugNegocio: (slug: string): void => {
    safeSetItem(KEYS.negocioSlug, slug);
  },

  getSlugNegocioGuardado: (): string | null => safeGetItem(KEYS.negocioSlug),

  // Flujo "debe cambiar contraseña" — ver EMAIL_PENDIENTE_KEY. Se persiste al
  // recibir `debe_cambiar_password` en el login y se limpia al completar el
  // cambio, al hacer logout o al finalizar una sesión revocada.
  guardarEmailPendiente: (email: string): void => {
    safeSessionSet(EMAIL_PENDIENTE_KEY, email);
  },

  getEmailPendienteGuardado: (): string | null => safeSessionGet(EMAIL_PENDIENTE_KEY),

  limpiarEmailPendiente: (): void => {
    safeSessionRemove(EMAIL_PENDIENTE_KEY);
  },
};