'use client';

import { Suspense, useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { esRedirectSeguro } from '@/lib/esRedirectSeguro';
import { resolveAuthRoute, type AuthRouteSnapshot } from '@/lib/resolveAuthRoute';
import { classifyTenant } from '@/lib/authRouteClasses';
import { useAuthStore } from '@/store/useAuthStore';
import { useLoadingStore } from '@/store/useLoadingStore';
import { initTheme } from '@/store/useThemeStore';
import { initLocale, useLocaleStore } from '@/store/useLocaleStore';
import { Loader } from '@/components/Loader';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ConfirmSheetHost } from '@/components/ConfirmSheetHost';
import { useConfirmStore, resolveDialog } from '@/store/useConfirmStore';
import { MotivoCancelacionSheetHost } from '@/components/MotivoCancelacionSheetHost';
import { PrecioServiciosSheetHost } from '@/components/PrecioServiciosSheetHost';
import { HistorialClienteSheetHost } from '@/components/HistorialClienteSheetHost';
import { ToastHost } from '@/components/ToastHost';
import { colors } from '@/theme/colors';

// Route classification (public / neutral / change-pw / blocked / protected)
// and the allow/redirect/blank decision now live in the pure, tested
// `resolveAuthRoute` + `classifyTenant` (design D2). `'/login'` still matches
// `/login/{slug}` (custom per-business login) — `classifyTenant` uses the same
// prefix rule the old inline `esRutaPublica` did.

// Panel de administración — identidad, guard y store completamente
// separados del tenant (ver design admin-panel decisión #7 y
// app/(admin)/admin/layout.tsx, que tiene su propio guard). Este guard
// NUNCA debe evaluar ni redirigir nada en admin.turnetto.com: sin este
// corte, alguien sin sesión tenant que entra ahí sería expulsado a
// /login?redirect=... antes de poder loguearse como admin.
//
// Detecta por HOST, no por prefijo de pathname — hasta hace poco esto
// era pathname.startsWith('/admin'), pero admin.turnetto.com ahora sirve
// URLs limpias (/, /login, /suscripciones...) sin ese prefijo (ver
// middleware.ts), así que ese chequeo dejó de matchear nada ahí. Bug
// real visto en prod: loguearse en admin quedaba en bucle infinito
// entre "/" y "/login" — este guard (tenant) empujaba a /login por no
// reconocer "/" como admin, y el guard admin (que sí sabe de las rutas
// limpias) empujaba de vuelta a "/".
const ADMIN_HOST = 'admin.turnetto.com';

function esRutaAdmin(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === ADMIN_HOST;
}

// `esRedirectSeguro` vive ahora en `@/lib/esRedirectSeguro` (módulo puro,
// testeado). Se re-exporta acá para no romper imports existentes.
export { esRedirectSeguro };

// Revocation still routes through here for now (Slice 4 replaces it with the
// coalesced `SESSION_REVOKED` + graceful modal). `authStatus: 'unauthenticated'`
// is what makes the guard react — the resolver reads `authStatus`, not the raw
// `token` field, so clearing the token alone would leave protected content
// mounted.
const CLEARED_AUTH_STATE = {
  user: null,
  token: null,
  loading: false,
  error: null,
  debeCambiarPassword: false,
  emailPendiente: null,
  subscriptionExpired: false,
  supportInfo: null,
  daysLeft: null,
  inicializado: true,
  mostrarBienvenida: false,
  esPrimerLogin: false,
  authStatus: 'unauthenticated' as const,
  subscriptionChecked: true,
};

function ProvidersInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authStatus, mostrarBienvenida } = useAuthStore();
  const isLoading = useLoadingStore(state => state.isLoading);
  const { locale, messages, mensajesListos } = useLocaleStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    useAuthStore.getState().inicializar();
    initTheme();
    initLocale();
    setMounted(true);
  }, []);

  // Un confirm/alert (ConfirmSheetHost) vive en este layout raíz, no en la
  // pantalla que lo abrió — nunca se desmonta con la navegación. Sin este
  // efecto, si el usuario navega mientras el diálogo sigue abierto (back del
  // celular, redirect del guard de arriba, etc.), quedaba flotando sobre la
  // pantalla nueva y, si lo confirmaba ahí, disparaba la acción original
  // (ej. "desactivar cliente") atada a un contexto que el usuario ya
  // abandonó. Se cancela solo (como si tocara "cancelar") en cuanto cambia
  // la ruta — no dispara nada, cierra sin ejecutar la acción pendiente.
  useEffect(() => {
    if (useConfirmStore.getState().dialog) resolveDialog(false);
  }, [pathname]);

  // Escucha eventos del interceptor de Axios (evita dependencia circular api ↔ store).
  // Slice 4 makes the interceptor intent-only (emit a recheck instead of
  // latching) and swaps `session-expired` for the graceful modal; for now both
  // events just route the transition through `authStatus` so the resolver reacts.
  useEffect(() => {
    const onSessionExpired      = () => useAuthStore.setState(CLEARED_AUTH_STATE);
    const onSubscriptionExpired = () => {
      useAuthStore.getState().setSubscriptionExpired(true);
      useAuthStore.getState().dispatchAuth({ type: 'SUBSCRIPTION_CHECKED', blocked: true });
    };

    window.addEventListener('session-expired',      onSessionExpired);
    window.addEventListener('subscription-expired', onSubscriptionExpired);
    return () => {
      window.removeEventListener('session-expired',      onSessionExpired);
      window.removeEventListener('subscription-expired', onSubscriptionExpired);
    };
  }, []);

  // PWA — un standalone de iOS que vuelve de estar en background suele
  // resumir el WKWebView suspendido sin recargar nada, así que puede seguir
  // corriendo JS de un deploy viejo indefinidamente (next-pwa activa el SW
  // nuevo con skipWaiting, pero eso no toca una pestaña ya abierta). Al
  // volver a foreground forzamos que el navegador chequee si hay un SW más
  // nuevo; si lo encuentra y toma control, recargamos para quedar al día.
  // hadController evita el reload espurio de la primera visita (donde
  // esta misma carga puede pasar a estar controlada por primera vez, algo
  // que también dispara "controllerchange" pero no es una actualización).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // next-pwa (register: true) inyecta su script de auto-registro en el
    // entry 'main.js' de webpack — eso es Pages Router. Esta app es App
    // Router (entry 'main-app'), así que esa inyección nunca corrió: cero
    // requests a /sw.js al cargar la página, en ningún dominio, nunca (
    // confirmado con DevTools). Sin esto ningún navegador ve un service
    // worker activo, así que Chrome/Android jamás ofrece "Instalar app"
    // completo — solo el fallback de "Añadir a inicio" que no lo necesita.
    // Registro manual acá, único lugar de la app que ya maneja el ciclo
    // de vida del SW (controllerchange/update de abajo).
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando online-only — no es
      // fatal, no bloqueamos nada por esto.
    });

    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (hadController) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => reg?.update());
      }
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('focus', checkForUpdate);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, []);

  // ── Route decision: the single pure resolver (design D2) ──────────────
  // The old dual logic (a redirect `useEffect` chain + a parallel
  // `puedeMostrarContenido` if/else that had to be kept byte-for-byte in sync)
  // is gone. `resolveAuthRoute` decides allow/redirect/blank once; the effect
  // only navigates, the render only gates. They can never disagree.
  const isAdmin = esRutaAdmin(); // window read — stays outside the pure fn
  const qs = searchParams.toString();
  const snapshot: AuthRouteSnapshot = {
    status: authStatus,
    // `mensajesListos` avoids the flash of Spanish on a pt-BR user's first
    // paint: the `es` catalog is synchronous but pt-BR loads via `await
    // import()`, so there is a tick where it is not ready yet.
    i18nReady: Boolean(mounted && mensajesListos),
  };
  const route = resolveAuthRoute(
    snapshot,
    // `searchParams.toString()` drops the leading `?`; the resolver
    // concatenates `pathname + search` verbatim, so prepend it when non-empty.
    { pathname, search: qs ? `?${qs}` : '' },
    classifyTenant,
  );
  const redirectTo = route.type === 'redirect' ? route.to : null;

  // The admin panel guards itself (app/(admin)/admin/layout.tsx) — this tenant
  // guard never redirects there and never blanks its children.
  useEffect(() => {
    if (isAdmin) return;
    if (redirectTo) router.push(redirectTo);
  }, [isAdmin, redirectTo, router]);

  const puedeMostrarContenido = isAdmin || route.type === 'allow';

  return (
    <NextIntlClientProvider locale={locale} messages={messages ?? undefined} timeZone="America/Argentina/Buenos_Aires">
      {puedeMostrarContenido ? children : <div style={{ minHeight: '100vh', backgroundColor: colors.background }} />}
      <Loader visible={isLoading} />
      {mostrarBienvenida && <WelcomeScreen />}
      <ConfirmSheetHost />
      <MotivoCancelacionSheetHost />
      <PrecioServiciosSheetHost />
      <HistorialClienteSheetHost />
      <ToastHost />
    </NextIntlClientProvider>
  );
}

// useSearchParams() (leído en ProvidersInner para el redirect post-login)
// necesita un límite de Suspense arriba — sin esto, Next.js deoptea TODA la
// app a client-side rendering en el build en vez de solo esta lectura. El
// fallback es el mismo blanco que ProvidersInner ya usa para tapar el flash
// mientras se resuelve el estado de auth, así que no se nota un fallback
// distinto en la práctica.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: colors.background }} />}>
      <ProvidersInner>{children}</ProvidersInner>
    </Suspense>
  );
}