import api from '@/lib/api';

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