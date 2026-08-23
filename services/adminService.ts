import adminApi from '@/lib/adminApi';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface AdminUser {
  id: number;
  name: string;
  email: string;
}

export interface AdminLoginResponse {
  admin: AdminUser;
  token: string;
  expires_at: string;
}

export interface NegocioSubscription {
  ends_at: string;
  status: string;
  renewed_at: string | null;
}

// GET admin/negocios/buscar — búsqueda puntual (max 5), nunca un listado
// paginable. Ver AdminController::buscarNegocio en el backend.
export interface NegocioLookupResult {
  id: number;
  name: string;
  slug: string;
  email: string;
  is_exempt: boolean;
  subscription: NegocioSubscription | null;
}

export interface CrearNegocioPayload {
  name: string;
  email: string;
  profesional_nombre: string;
  profesional_apellido: string;
  // Opcional: cuando true, el backend no crea suscripción/período de prueba
  // para este negocio (ver AdminController::crearNegocio). Omitido = flujo
  // normal con período de prueba, igual que antes de este campo existir.
  is_exempt?: boolean;
}

export interface CrearNegocioResponse {
  message: string;
  user: { id: number; name: string; slug: string; email: string };
  password_provisoria: string;
}

export interface RenewSubscriptionResponse {
  message: string;
  user_id: number;
  ends_at: string;
}

// ─────────────────────────────────────────────
// Keys de localStorage — deliberadamente distintas de KEYS en
// services/authService.ts (auth_token/auth_user), ver design admin-panel
// decisión #7.
// ─────────────────────────────────────────────
const KEYS = {
  token: 'admin_token',
  admin: 'admin_user',
};

// Mismos wrappers seguros que authService.ts — ver ese archivo para el
// porqué (localStorage puede tirar en modo privado de iOS Safari).
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
export const adminService = {

  login: async (email: string, password: string): Promise<AdminLoginResponse> => {
    const response = await adminApi.post<AdminLoginResponse>('/admin/login', { email, password });
    safeSetItem(KEYS.token, response.data.token);
    safeSetItem(KEYS.admin, JSON.stringify(response.data.admin));
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await adminApi.post('/admin/logout');
    } finally {
      safeRemoveItem(KEYS.token);
      safeRemoveItem(KEYS.admin);
    }
  },

  me: async (): Promise<AdminUser> => {
    const response = await adminApi.get<AdminUser>('/admin/me');
    return response.data;
  },

  // Usado por app/(admin)/admin/negocios/nuevo/page.tsx (Phase 4).
  crearNegocio: async (data: CrearNegocioPayload): Promise<CrearNegocioResponse> => {
    const response = await adminApi.post<CrearNegocioResponse>('/admin/negocios', data);
    return response.data;
  },

  buscarNegocio: async (q: string): Promise<NegocioLookupResult[]> => {
    const response = await adminApi.get<NegocioLookupResult[]>('/admin/negocios/buscar', { params: { q } });
    return response.data;
  },

  // Usado por app/(admin)/admin/suscripciones/page.tsx — GET admin/negocios
  // devuelve TODOS los negocios sin paginar (mismo shape por item que
  // buscarNegocio(), ordenados por vencimiento más próximo primero). Ver
  // AdminController::listarNegocios en el backend. Distinto de
  // buscarNegocio(): ese es búsqueda puntual por query, este es el listado
  // completo que la pantalla filtra client-side.
  listarNegocios: async (): Promise<NegocioLookupResult[]> => {
    const response = await adminApi.get<NegocioLookupResult[]>('/admin/negocios');
    return response.data;
  },

  // Usado por app/(admin)/admin/suscripciones/page.tsx (Phase 5).
  renovarSuscripcion: async (userId: number, force = false): Promise<RenewSubscriptionResponse> => {
    const response = await adminApi.post<RenewSubscriptionResponse>(
      `/admin/subscriptions/${userId}/renew`,
      null,
      force ? { params: { force: true } } : undefined
    );
    return response.data;
  },

  // ─────────────────────────────────────────────
  // Helpers de storage — síncronos en web
  // ─────────────────────────────────────────────
  getToken: (): string | null => safeGetItem(KEYS.token),

  getAdminGuardado: (): AdminUser | null => {
    const raw = safeGetItem(KEYS.admin);
    return raw ? JSON.parse(raw) : null;
  },

  estaAutenticado: (): boolean => !!safeGetItem(KEYS.token),
};
