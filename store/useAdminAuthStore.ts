import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { adminService, AdminUser } from '@/services/adminService';

// Store completamente separado de store/useAuthStore.ts (tenant) — ver
// design admin-panel decisión #7. No se extiende useAuthStore ni se
// comparte estado: la sesión admin y la sesión tenant deben poder
// coexistir en la misma pestaña sin interferirse (ej. una profesional
// logueada que el founder atiende por soporte, mientras el founder mismo
// tiene sesión admin abierta en otra pestaña del mismo navegador).
interface AdminAuthState {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  inicializado: boolean;
  // Sesión vencida detectada (por 401 o por revisarExpiracion) mientras la
  // pantalla sigue montada — ver requerirReautenticacion().
  reautenticacionRequerida: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  inicializar: () => void;
  clearError: () => void;
  revisarExpiracion: () => void;
  requerirReautenticacion: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  admin: null,
  token: null,
  loading: false,
  error: null,
  inicializado: false,
  reautenticacionRequerida: false,

  clearError: () => set({ error: null }),

  // Sincrónico en web (localStorage es síncrono) — mismo patrón que
  // useAuthStore.inicializar().
  inicializar: () => {
    try {
      const token = adminService.getToken();
      // Vencido desde antes de que esta pestaña siquiera montara (ej. la
      // abrís de nuevo al otro día) — no tiene sentido pintar admin
      // autenticado un instante para que el próximo request lo tire con un
      // 401 silencioso (ver revisarExpiracion para el caso de pestaña ya
      // abierta).
      if (token && adminService.tokenExpirado()) {
        set({ token: null, admin: null, inicializado: true });
        return;
      }
      const admin = adminService.getAdminGuardado();
      set({ token, admin, inicializado: true });
    } catch {
      set({ inicializado: true });
    }
  },

  // Chequeo client-side del expires_at guardado — no espera a que un
  // request falle con 401. Ver app/(admin)/admin/layout.tsx, que lo llama
  // al volver la pestaña a visible (feedback 2026-10-02: "que no espere a
  // una nueva petición, que lo haga apenas vuelva"). Ya NO desloguea de
  // una: pide reautenticación sin tocar admin/token, para no desmontar la
  // pantalla (y perder lo que haya en un formulario) — ver
  // requerirReautenticacion() y feedback 2026-10-02 "me desloguea y pierdo
  // el formulario".
  revisarExpiracion: () => {
    if (get().token && adminService.tokenExpirado()) {
      set({ reautenticacionRequerida: true });
    }
  },

  // Disparado por el interceptor 401 de lib/adminApi.ts (vía el evento
  // 'admin-session-expired' en app/(admin)/admin/layout.tsx) y por
  // revisarExpiracion(). Deliberadamente NO limpia admin/token: la pantalla
  // actual (y cualquier formulario sin guardar) sigue montada debajo del
  // modal de reautenticación — solo un logout explícito o un reingreso
  // exitoso la resuelven.
  requerirReautenticacion: () => set({ reautenticacionRequerida: true }),

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await adminService.login(email, password);
      set({ admin: result.admin, token: result.token, loading: false, reautenticacionRequerida: false });
      return true;
    } catch (e: unknown) {
      const message = (isAxiosError(e) && e.response?.data?.message) || 'No se pudo iniciar sesión.';
      set({ loading: false, error: message });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await adminService.logout();
    } finally {
      set({ admin: null, token: null, loading: false, error: null, reautenticacionRequerida: false });
    }
  },
}));
