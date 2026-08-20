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
  recordatorio_automatico: boolean;
  hora_recordatorio: string;
  sena_monto: number | null;
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
};