import { create } from 'zustand';
import { authService, SupportInfo, User } from '@/services/authService';
import api from '@/lib/api';
import { authTransition, type AuthEvent, type AuthStatus } from '@/lib/authMachine';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { resolveLocale } from '@/lib/locale';
import { useLocaleStore, setLocale, tStatic } from '@/store/useLocaleStore';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { esRedirectSeguro } from '@/lib/esRedirectSeguro';

// sessionStorage (no localStorage): sobrevive a un refresh accidental dentro
// de la misma pestaña, pero se limpia al cerrarla — evita repetir la
// bienvenida en cada pull-to-refresh táctil sin dejar de mostrarla al abrir
// la app de nuevo.
const BIENVENIDA_KEY = 'bienvenida_mostrada';

// Boot-gate backstop (design D4 + PR3 verify WARNING-2): the axios 15s
// `timeout` bounds each individual request, but the boot `checkSubscription()`
// fans out to three calls — this shorter race keeps the blank boot gate from
// lingering if any one of them hangs mid-response. On timeout we fail open.
const BOOT_CHECK_TIMEOUT_MS = 8000;

// Module-scoped single-flight latch for `recheckSubscription` (design D3): N
// parallel 403-driven recheck intents collapse into ONE `/auth/subscription-status`
// request and ONE state transition.
let recheckInFlight: Promise<void> | null = null;

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
  // True when the last `checkSubscription()` could not reach
  // `/auth/subscription-status` at all (offline, timeout). Lets
  // `/subscription-expired` show a distinct "no pudimos verificar" message
  // instead of a false "sigue vencida". Reset on every successful status read.
  subscriptionCheckFailed: boolean;
  supportInfo: SupportInfo | null;
  daysLeft: number | null;
  subscriptionEndsAt: string | null;
  isExempt: boolean;
  mostrarBienvenida: boolean;
  esPrimerLogin: boolean;

  // Auth state machine (design D1). `authStatus` is the single source of truth
  // the route guard reads; `dispatchAuth` is the ONLY way to mutate it — it has
  // no side effects, navigation/storage/api all live in the actions below.
  authStatus: AuthStatus;
  // False until the boot `checkSubscription()` settles (success OR total
  // failure). While false the machine is still `booting` and the guard blanks
  // every protected route — no false `/login` or `/subscription-expired` flash.
  subscriptionChecked: boolean;
  // Route (pathname + query) the user was on when the session was revoked, for
  // `?redirect=` preservation. Populated in Slice 4; kept here so the field
  // exists for the machine wiring.
  sessionEndOrigin: string;

  dispatchAuth: (event: AuthEvent) => void;

  setSubscriptionExpired: (value: boolean) => void;
  setMostrarBienvenida: (value: boolean) => void;
  checkSubscription: (isRecheck?: boolean) => Promise<void>;
  // Single-flight authoritative recheck triggered by the interceptor's
  // `auth:subscription-suspect` intent event. Concurrent calls share one promise.
  recheckSubscription: () => Promise<void>;
  // Graceful, coalesced 401 handling (design D5). Transitions to
  // `session-ending` (modal owns the screen), keeps `user` for the dimmed
  // view, nulls `token`, captures the origin route for `?redirect=`.
  handleSessionRevoked: () => void;
  // Called by `SessionEndedModal` after the countdown / "Entendido": clears the
  // remaining auth state + storage, LOGOUT-transitions the machine, and returns
  // the post-logout destination (`/login?redirect=<origin>` or `/login`).
  finalizeSessionEnd: () => string;
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
  subscriptionCheckFailed: false,
  supportInfo: null,
  daysLeft: null,
  subscriptionEndsAt: null,
  isExempt: false,
  mostrarBienvenida: false,
  esPrimerLogin: false,
  authStatus: 'booting',
  subscriptionChecked: false,
  sessionEndOrigin: '',

  dispatchAuth: (event) => set({ authStatus: authTransition(get().authStatus, event) }),

  setSubscriptionExpired: (value) => set({ subscriptionExpired: value }),
  setMostrarBienvenida: (value) => set({ mostrarBienvenida: value }),
  clearError: () => set({ error: null }),

  // ─────────────────────────────────────────────
  // checkSubscription
  // ─────────────────────────────────────────────
  checkSubscription: async (isRecheck = false) => {
    try {
      // Design D4: each sub-call settles independently. A `me()` or
      // `getSupportInfo()` rejection MUST NOT stop `subscription-status` from
      // updating `subscriptionExpired` / the machine state.
      const [statusResult, supportResult, meResult] = await Promise.allSettled([
        api.get('/auth/subscription-status'),
        authService.getSupportInfo(),
        authService.me(),
      ]);

      if (statusResult.status === 'fulfilled') {
        const statusData = statusResult.value.data;
        set({
          // `blocked` keys off `status !== 'ACTIVO'` — no dependence on the
          // additive backend `code` (design D4 / D7).
          subscriptionExpired: statusData.status !== 'ACTIVO',
          daysLeft: statusData.days_left,
          subscriptionEndsAt: statusData.ends_at,
          isExempt: statusData.is_exempt,
          subscriptionCheckFailed: false,
        });
      } else {
        set({ subscriptionCheckFailed: true });
        logAuthEvent('checkSubscription.status-failed', { err: statusResult.reason });
      }

      if (supportResult.status === 'fulfilled') {
        set({ supportInfo: supportResult.value });
      } else {
        logAuthEvent('checkSubscription.support-failed', { err: supportResult.reason });
      }

      if (meResult.status === 'fulfilled') {
        const meResponse = meResult.value;
        // Reconcile de idioma cross-device (ver spec "Cross-device
        // persistence"): si el idioma cambió en otro dispositivo, lo
        // aplicamos acá sin round-trip extra. No pisamos `user` completo con
        // meResponse — solo el idioma.
        const localeRemoto = resolveLocale(meResponse.locale);
        if (localeRemoto !== useLocaleStore.getState().locale) {
          await setLocale(localeRemoto);
        }

        // whatsapp_requiere_envio_manual puede cambiar server-side en
        // cualquier momento (ej. el ratio de fallos de Cloud API sube) sin
        // que el cliente se entere — este campo sí necesita refrescarse acá
        // para que el banner de recordatorios pendientes aparezca sin
        // depender de un logout/login.
        const userActual = get().user;
        if (userActual) {
          const userActualizado = {
            ...userActual,
            whatsapp_requiere_envio_manual: meResponse.whatsapp_requiere_envio_manual,
          };
          set({ user: userActualizado });
          try {
            localStorage.setItem('auth_user', JSON.stringify(userActualizado));
          } catch {
            // sin acceso a localStorage — no bloqueamos
          }
        }
      } else {
        logAuthEvent('checkSubscription.me-failed', { err: meResult.reason });
      }
    } finally {
      // Route the result through the machine. On a `subscription-status`
      // failure `subscriptionExpired` keeps its prior value — at boot that is
      // `false`, so the machine leaves `booting` fail-open and is never wedged.
      const blocked = get().subscriptionExpired;
      get().dispatchAuth({
        type: isRecheck ? 'RECHECK_RESULT' : 'SUBSCRIPTION_CHECKED',
        blocked,
      });
      set({ subscriptionChecked: true });
    }
  },

  // Design D3 — single-flight. `recheckInFlight` is module-scoped so every
  // caller in the same tab shares the one promise; it self-clears on settle.
  recheckSubscription: () =>
    (recheckInFlight ??= get()
      .checkSubscription(true)
      .finally(() => {
        recheckInFlight = null;
      })),

  // Design D5 — graceful, coalesced 401 handling.
  handleSessionRevoked: () => {
    // Coalesce parallel 401s: once we are ending the session, ignore the rest.
    if (get().authStatus === 'session-ending') return;

    const raw = window.location.pathname + window.location.search;
    const origin = esRedirectSeguro(raw) ? raw : '';

    // Keep `user` — the dimmed last screen still reads it under the modal.
    set({ token: null, sessionEndOrigin: origin });
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch {
      // sin acceso a localStorage — igual seguimos con la transición
    }
    get().dispatchAuth({ type: 'SESSION_REVOKED' });
  },

  finalizeSessionEnd: () => {
    const origin = get().sessionEndOrigin;
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch {
      // sin acceso a localStorage
    }
    set({
      user: null,
      token: null,
      loading: false,
      error: null,
      debeCambiarPassword: false,
      // `emailPendiente` sessionStorage persistence is Slice 7 — here we only
      // clear the in-memory field.
      emailPendiente: null,
      subscriptionExpired: false,
      subscriptionCheckFailed: false,
      supportInfo: null,
      daysLeft: null,
      subscriptionEndsAt: null,
      isExempt: false,
      mostrarBienvenida: false,
      esPrimerLogin: false,
      sessionEndOrigin: '',
    });
    get().dispatchAuth({ type: 'LOGOUT' });
    return origin ? `/login?redirect=${encodeURIComponent(origin)}` : '/login';
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
        get().dispatchAuth({ type: 'BOOT_HAS_TOKEN' });
        // Boot gate: the machine stays `booting` until `checkSubscription`
        // settles (it self-dispatches `SUBSCRIPTION_CHECKED` + sets
        // `subscriptionChecked` in its own `finally`, even on total failure).
        // The race below is a hard backstop: if any sub-call hangs mid-response
        // past `BOOT_CHECK_TIMEOUT_MS`, force the gate open fail-open so the
        // app never blanks forever (PR3 verify WARNING-2).
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), BOOT_CHECK_TIMEOUT_MS);
        });
        Promise.race([get().checkSubscription(), timeout]).then((result) => {
          clearTimeout(timer);
          if (result === 'timeout' && !get().subscriptionChecked) {
            logAuthEvent('checkSubscription.boot-timeout');
            get().dispatchAuth({ type: 'SUBSCRIPTION_CHECKED', blocked: false });
            set({ subscriptionChecked: true });
          }
        });
      } else {
        set({ token, user, inicializado: true });
        get().dispatchAuth({ type: 'BOOT_NO_TOKEN' });
      }
    } catch {
      set({ inicializado: true });
      get().dispatchAuth({ type: 'BOOT_NO_TOKEN' });
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
          get().dispatchAuth({ type: 'MUST_CHANGE_PW' });
          return true;
        }

        sessionStorage.setItem(BIENVENIDA_KEY, '1');
        // Cubre a quien nunca visitó /login/{slug} (ej. logueó desde el
        // link genérico la primera vez) — así la próxima apertura de la PWA
        // instalada (que siempre aterriza en /login sin slug) igual muestra
        // su logo. Ver KEYS.negocioSlug en authService.ts.
        authService.guardarSlugNegocio(result.user.slug);
        set({
          user: result.user, token: result.token, loading: false,
          mostrarBienvenida: true, esPrimerLogin: true,
        });
        await get().checkSubscription();
        get().dispatchAuth({ type: 'LOGIN_OK', blocked: get().subscriptionExpired });
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
        get().dispatchAuth({ type: 'LOGIN_OK', blocked: get().subscriptionExpired });
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
        // The clear-first + bounded-POST rework is Slice 7; here we only route
        // the transition through the machine so the guard reacts to `authStatus`.
        get().dispatchAuth({ type: 'LOGOUT' });
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