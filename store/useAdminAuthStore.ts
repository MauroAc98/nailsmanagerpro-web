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
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
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
      const admin = adminService.getAdminGuardado();
      set({ token, admin, inicializado: true });
    } catch {
      set({ inicializado: true });
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
