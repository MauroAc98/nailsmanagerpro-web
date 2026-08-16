import { create } from 'zustand';
import { authService, SupportInfo, User } from '@/services/authService';
import api from '@/lib/api';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { resolveLocale } from '@/lib/locale';
import { useLocaleStore, setLocale, tStatic } from '@/store/useLocaleStore';

// sessionStorage (no localStorage): sobrevive a un refresh accidental dentro
// de la misma pestaña, pero se limpia al cerrarla — evita repetir la
// bienvenida en cada pull-to-refresh táctil sin dejar de mostrarla al abrir
// la app de nuevo.
const BIENVENIDA_KEY = 'bienvenida_mostrada';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  inicializado: boolean;
  debeCambiarPassword: boolean;
  emailPendiente: string | null;
  subscriptionExpired: boolean;
  supportInfo: SupportInfo | null;
  daysLeft: number | null;
  subscriptionEndsAt: string | null;
  isExempt: boolean;
  mostrarBienvenida: boolean;
  esPrimerLogin: boolean;

  setSubscriptionExpired: (value: boolean) => void;
  setMostrarBienvenida: (value: boolean) => void;
  checkSubscription: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  cambiarPasswordObligatorio: (data: {
    password_actual: string;
    password: string;
    password_confirmation: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  inicializar: () => void;
  updatePerfil: (data: Partial<User> & { password?: string; password_confirmation?: string }) => Promise<void>;
  subirLogo: (archivo: File) => Promise<void>;
  clearError: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (data: {
    email: string;
    code: string;
    password: string;
    password_confirmation: string;
  }) => Promise<boolean>;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,
  inicializado: false,
  debeCambiarPassword: false,
  emailPendiente: null,
  subscriptionExpired: false,
  supportInfo: null,
  daysLeft: null,
  subscriptionEndsAt: null,
  isExempt: false,
  mostrarBienvenida: false,
  esPrimerLogin: false,

  setSubscriptionExpired: (value) => set({ subscriptionExpired: value }),
  setMostrarBienvenida: (value) => set({ mostrarBienvenida: value }),
  clearError: () => set({ error: null }),

  // ─────────────────────────────────────────────
  // checkSubscription
  // ─────────────────────────────────────────────
  checkSubscription: async () => {
    try {
      const [statusResponse, supportResponse, meResponse] = await Promise.all([
        api.get('/auth/subscription-status'),
        authService.getSupportInfo(),
        authService.me(),
      ]);
      set({
        subscriptionExpired: statusResponse.data.status === 'VENCIDO',
        daysLeft: statusResponse.data.days_left,
        subscriptionEndsAt: statusResponse.data.ends_at,
        isExempt: statusResponse.data.is_exempt,
        supportInfo: supportResponse,
      });

      // Reconcile de idioma cross-device (ver spec "Cross-device
      // persistence" y design.md "Cross-device reconcile via existing
      // bootstrap call"): si el idioma cambió en otro dispositivo, lo
      // aplicamos acá sin round-trip extra. No pisamos `user` completo
      // con meResponse — solo el idioma, para no introducir cambios de
      // comportamiento fuera del alcance de esta fase.
      const localeRemoto = resolveLocale(meResponse.locale);
      if (localeRemoto !== useLocaleStore.getState().locale) {
        await setLocale(localeRemoto);
      }

      // whatsapp_requiere_envio_manual (y whatsapp_estado) pueden cambiar
      // server-side en cualquier momento (un cron detecta que el WhatsApp
      // automático se rompió) sin que el cliente se entere — a diferencia
      // del resto de `user`, que es estable durante la sesión, este par sí
      // necesita refrescarse acá para que el banner de recordatorios
      // pendientes aparezca sin depender de un logout/login.
      const userActual = get().user;
      if (userActual) {
        const userActualizado = {
          ...userActual,
          whatsapp_requiere_envio_manual: meResponse.whatsapp_requiere_envio_manual,
          whatsapp_estado: meResponse.whatsapp_estado,
        };
        set({ user: userActualizado });
        localStorage.setItem('auth_user', JSON.stringify(userActualizado));
      }
    } catch {
      // Si falla no bloqueamos
    }
  },

  // ─────────────────────────────────────────────
  // inicializar — sincrónico en web (localStorage es síncrono)
  // ─────────────────────────────────────────────
  inicializar: () => {
    try {
      const token = localStorage.getItem('auth_token');
      const raw   = localStorage.getItem('auth_user');
      const user  = raw ? JSON.parse(raw) : null;
      if (token) {
        // Sesión ya existente al abrir la app — bienvenida con mensaje de
        // "regreso", pero solo una vez por pestaña (ver BIENVENIDA_KEY).
        const yaSeMostro = sessionStorage.getItem(BIENVENIDA_KEY) === '1';
        if (!yaSeMostro) sessionStorage.setItem(BIENVENIDA_KEY, '1');
        set({ token, user, inicializado: true, mostrarBienvenida: !yaSeMostro, esPrimerLogin: false });
        get().checkSubscription();
      } else {
        set({ token, user, inicializado: true });
      }
    } catch {
      set({ inicializado: true });
    }
  },

  // ─────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────
  login: async (email, password) => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const result = await authService.login(email, password);

        if ('debe_cambiar_password' in result) {
          set({ loading: false, debeCambiarPassword: true, emailPendiente: result.email });
          return true;
        }

        sessionStorage.setItem(BIENVENIDA_KEY, '1');
        set({
          user: result.user, token: result.token, loading: false,
          mostrarBienvenida: true, esPrimerLogin: true,
        });
        await get().checkSubscription();
        return true;
      } catch (e: any) {
        const message =
          e.response?.data?.message ??
          e.response?.data?.errors?.email?.[0] ??
          tStatic('auth.Errors.loginFailed');
        set({ loading: false, error: message });
        return false;
      }
    });
  },

  // ─────────────────────────────────────────────
  // cambiarPasswordObligatorio
  // ─────────────────────────────────────────────
  cambiarPasswordObligatorio: async (data) => {
    const email = get().emailPendiente;
    if (!email) {
      set({ error: tStatic('auth.Errors.emailNotFound') });
      return false;
    }

    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const { user, token } = await authService.cambiarPasswordObligatorio({ email, ...data });
        sessionStorage.setItem(BIENVENIDA_KEY, '1');
        set({
          user,
          token,
          loading: false,
          debeCambiarPassword: false,
          emailPendiente: null,
          mostrarBienvenida: true,
          esPrimerLogin: true,
        });
        await get().checkSubscription();
        return true;
      } catch (e: any) {
        const message =
          e.response?.data?.message ??
          e.response?.data?.errors?.password_actual?.[0] ??
          tStatic('auth.Errors.passwordUpdateFailed');
        set({ loading: false, error: message });
        return false;
      }
    });
  },

  // ─────────────────────────────────────────────
  // logout
  // ─────────────────────────────────────────────
  logout: async () => {
    set({ loading: true });
    return withGlobalLoader(async () => {
      try {
        await authService.logout();
      } finally {
        set({
          user: null,
          token: null,
          loading: false,
          error: null,
          debeCambiarPassword: false,
          emailPendiente: null,
          subscriptionExpired: false,
          supportInfo: null,
          daysLeft: null,
          subscriptionEndsAt: null,
          isExempt: false,
          mostrarBienvenida: false,
          esPrimerLogin: false,
        });
      }
    });
  },

  // ─────────────────────────────────────────────
  // updatePerfil
  // ─────────────────────────────────────────────
  updatePerfil: async (data) => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const user = await authService.updatePerfil(data);
        set({ user, loading: false });
      } catch (e: any) {
        const message = e.response?.data?.message ?? tStatic('auth.Errors.profileUpdateFailed');
        set({ loading: false, error: message });
        throw e;
      }
    });
  },

  // ─────────────────────────────────────────────
  // subirLogo
  // ─────────────────────────────────────────────
  // Sin withGlobalLoader a propósito (a diferencia de updatePerfil y el
  // resto de las acciones de este store): esto se dispara desde un tap
  // sobre el avatar circular en HeroPerfil, que maneja su propio spinner
  // chico superpuesto — un loader de pantalla completa sería demasiado
  // para subir una sola imagen. El error se re-lanza tal cual (sin tocar
  // `error` global) para que HeroPerfil lo capture y muestre con
  // extraerMensajeError + alertDialog, igual que ya hace perfil/page.tsx
  // con sus propios guardados.
  subirLogo: async (archivo) => {
    const user = await authService.subirLogo(archivo);
    set({ user });
  },

  // ─────────────────────────────────────────────
  // forgotPassword
  // ─────────────────────────────────────────────
  forgotPassword: async (email) => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        await authService.forgotPassword(email);
        set({ loading: false });
        return true;
      } catch (e: any) {
        const message =
          e.response?.data?.message ??
          e.response?.data?.errors?.email?.[0] ??
          tStatic('auth.Errors.codeSendFailed');
        set({ loading: false, error: message });
        return false;
      }
    });
  },

  // ─────────────────────────────────────────────
  // resetPassword
  // ─────────────────────────────────────────────
  resetPassword: async (data) => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        await authService.resetPassword(data);
        set({ loading: false });
        return true;
      } catch (e: any) {
        const message =
          e.response?.data?.message ??
          e.response?.data?.errors?.code?.[0] ??
          tStatic('auth.Errors.passwordUpdateFailed');
        set({ loading: false, error: message });
        return false;
      }
    });
  },
}));