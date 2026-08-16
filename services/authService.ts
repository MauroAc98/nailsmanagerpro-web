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
  evolution_instance_name: string | null;
  whatsapp_estado: 'conectado' | 'desconectado';
  // true por cualquiera de estas razones: (a) no hay instancia de WhatsApp
  // vinculada, (b) hay instancia pero con desconexión terminal reciente sin
  // reconexión posterior, o (c) el ratio de mensajes fallidos es alto —
  // aunque whatsapp_estado diga 'conectado'.
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
// Plantillas de WhatsApp
// ─────────────────────────────────────────────
export type TipoPlantilla = 'recordatorio' | 'confirmacion';

export interface WhatsappTemplate {
  id: number;
  user_id: number;
  tipo: TipoPlantilla;
  contenido: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// Keys de localStorage
// ─────────────────────────────────────────────
const KEYS = {
  token: 'auth_token',
  user:  'auth_user',
};

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const authService = {

  login: async (email: string, password: string): Promise<LoginResult> => {
    const response = await api.post<LoginResult>('/auth/login', { email, password });
    if ('debe_cambiar_password' in response.data) return response.data;
    localStorage.setItem(KEYS.token, response.data.token);
    localStorage.setItem(KEYS.user, JSON.stringify(response.data.user));
    return response.data;
  },

  cambiarPasswordObligatorio: async (data: {
    email: string;
    password_actual: string;
    password: string;
    password_confirmation: string;
  }): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/cambiar-password-obligatorio', data);
    localStorage.setItem(KEYS.token, response.data.token);
    localStorage.setItem(KEYS.user, JSON.stringify(response.data.user));
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.user);
    }
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  updatePerfil: async (data: Partial<User> & { password?: string; password_confirmation?: string }): Promise<User> => {
    const response = await api.put<User>('/perfil', data);
    localStorage.setItem(KEYS.user, JSON.stringify(response.data));
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
    localStorage.setItem(KEYS.user, JSON.stringify(response.data));
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

  whatsappTemplates: {
    obtener: async (): Promise<WhatsappTemplate[]> => {
      const response = await api.get<WhatsappTemplate[]>('/whatsapp-templates');
      return response.data;
    },
    actualizar: async (tipo: TipoPlantilla, contenido: string): Promise<WhatsappTemplate> => {
      const response = await api.put<WhatsappTemplate>(`/whatsapp-templates/${tipo}`, { contenido });
      return response.data;
    },
    resetear: async (tipo: TipoPlantilla): Promise<WhatsappTemplate> => {
      const response = await api.post<WhatsappTemplate>(`/whatsapp-templates/${tipo}/resetear`);
      return response.data;
    },
  },

  // ─────────────────────────────────────────────
  // Helpers de storage — síncronos en web
  // ─────────────────────────────────────────────
  getToken: (): string | null => localStorage.getItem(KEYS.token),

  getUsuarioGuardado: (): User | null => {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  },

  estaAutenticado: (): boolean => !!localStorage.getItem(KEYS.token),
};