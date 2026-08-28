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

// GET/PUT admin/settings — shape pensado para sumar más claves a futuro sin
// romper el contrato (ver AdminController::obtenerSettings/actualizarSettings).
export interface AdminSettings {
  dias_prueba_default: number;
}

// ─────────────────────────────────────────────
// WhatsApp Embedded Signup — conexiones por salón
// GET/POST admin/whatsapp/connections (WhatsappConnectionAdminController).
// El GET nunca está gateado (la pantalla tiene que verse aunque el
// onboarding esté deshabilitado); el POST sí. app_id/config_id/graph_version
// vienen del backend, NO como NEXT_PUBLIC_* (ver design §6: rotar el config
// de ES no debe forzar un rebuild del front).
// ─────────────────────────────────────────────
export type WhatsappConexionEstado = 'sin_conexion' | 'conectada' | 'por_vencer' | 'expirada';

export interface WhatsappEsConfig {
  enabled: boolean;
  app_id: string | null;
  config_id: string | null;
  graph_version: string;
}

export interface WhatsappSalonConexion {
  user_id: number;
  nombre: string;
  estado: WhatsappConexionEstado;
  display_phone_number: string | null;
  verified_name: string | null;
  // Epoch Unix en segundos, o null cuando el token no vence (ver design §Q4).
  token_expires_at: number | null;
}

export interface WhatsappConexionesResponse {
  es: WhatsappEsConfig;
  salones: WhatsappSalonConexion[];
}

export interface ConectarWhatsappPayload {
  user_id: number;
  code: string;
  waba_id: string;
  // Opcional: si el evento FINISH no lo trajo, el backend lo resuelve vía
  // GET /{waba_id}/phone_numbers (ver design §3 step 2).
  phone_number_id?: string;
}

export interface WhatsappConexionCreada {
  id: number;
  user_id: number;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  estado: WhatsappConexionEstado;
  token_expires_at: number | null;
}

// Cuerpo del 409 cuando el phone_number_id ya pertenece a otro salón
// (ver design §Q7 / apply-progress #389).
export interface WhatsappConexionConflicto {
  message: string;
  phone_number_id: string;
  salon_dueno: { id: number; name: string } | null;
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

  obtenerSettings: async (): Promise<AdminSettings> => {
    const response = await adminApi.get<AdminSettings>('/admin/settings');
    return response.data;
  },

  actualizarSettings: async (data: AdminSettings): Promise<AdminSettings> => {
    const response = await adminApi.put<AdminSettings>('/admin/settings', data);
    return response.data;
  },

  // Usado por app/(admin)/admin/whatsapp/page.tsx. Una fila por salón,
  // conectado o no (estado 'sin_conexion' para los que no tienen conexión).
  obtenerConexionesWhatsapp: async (): Promise<WhatsappConexionesResponse> => {
    const response = await adminApi.get<WhatsappConexionesResponse>('/admin/whatsapp/connections');
    return response.data;
  },

  // POST del intercambio de código de Embedded Signup. timeout explícito de
  // 45s: el backend hace 3 llamadas sincrónicas a Graph server-side (budget
  // ~39s, ver design §3), muy por encima de lo razonable para el default de
  // axios. El front además corre su propio timeout de operación (~60s) sobre
  // el handshake con Meta antes de este POST (ver hooks/useEmbeddedSignup.ts).
  conectarWhatsapp: async (payload: ConectarWhatsappPayload): Promise<WhatsappConexionCreada> => {
    const response = await adminApi.post<WhatsappConexionCreada>(
      '/admin/whatsapp/connections',
      payload,
      { timeout: 45000 },
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
