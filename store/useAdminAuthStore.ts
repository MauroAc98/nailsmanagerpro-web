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

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  inicializar: () => void;
  clearError: () => void;
  revisarExpiracion: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  admin: null,
  token: null,
  loading: false,
  error: null,
  inicializado: false,

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
  // una nueva petición, que lo haga apenas vuelva").
  revisarExpiracion: () => {
    if (get().token && adminService.tokenExpirado()) {
      set({ admin: null, token: null, error: null });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await adminService.login(email, password);
      set({ admin: result.admin, token: result.token, loading: false });
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
      set({ admin: null, token: null, loading: false, error: null });
    }
  },
}));
