'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { resolveAuthRoute, type AuthStatus } from '@/lib/resolveAuthRoute';
import { classifyAdmin } from '@/lib/authRouteClasses';
import { tienePrefijoAdmin } from '@/lib/esPanelAdmin';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { AdminReauthModal } from '@/components/admin/AdminReauthModal';
import { colors } from '@/theme/colors';

// pathname acá es el que ve el navegador — middleware.ts reescribe
// /login → /admin/login puertas adentro para admin.turnetto.com, pero
// usePathname() no ve rewrites, reporta el path LIMPIO. Por eso classifyAdmin
// y el `home: '/'` de abajo usan rutas sin /admin.

// Guard propio del panel admin — deliberadamente NO vive en
// app/providers.tsx (ver esRutaAdmin() ahí, que se limita a no interferir
// con esta ruta). Comparte la MISMA decisión pura que el guard tenant
// (resolveAuthRoute, design D2) pero con su propio store (useAdminAuthStore),
// su propia clave de sesión (admin_token vía adminService) y su propio mapa
// de rutas (classifyAdmin). Ver design admin-panel decisión #7.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, inicializado, inicializar, reautenticacionRequerida } = useAdminAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    inicializar();
    setMounted(true);
  }, [inicializar]);

  // Evento del interceptor de lib/adminApi.ts — evita dependencia circular
  // adminApi ↔ store, mismo patrón que 'session-expired' en
  // app/providers.tsx. Completamente aislado de ese: un 401 admin nunca
  // toca useAuthStore/auth_token, y viceversa.
  //
  // Ya NO limpia admin/token acá — eso desmontaba `children` de una,
  // perdiendo cualquier formulario sin guardar (feedback 2026-10-02:
  // "completo el alta de un negocio, le doy guardar y me desloguea"). En su
  // lugar pide reautenticación: la pantalla sigue montada debajo del modal.
  useEffect(() => {
    const onAdminSessionExpired = () => useAdminAuthStore.getState().requerirReautenticacion();
    window.addEventListener('admin-session-expired', onAdminSessionExpired);
    return () => window.removeEventListener('admin-session-expired', onAdminSessionExpired);
  }, []);

  // El token admin vence a horas fijas desde el login (12h, ver
  // AdminAuthController::login en el backend), no "mientras esté activo" —
  // sin este chequeo, una pestaña dejada abierta recién se entera de que la
  // sesión venció cuando el próximo click dispara un request y ese 401
  // llega (feedback 2026-10-02: "que no espere a una nueva petición, que lo
  // haga apenas vuelva"). Revisamos el expires_at guardado apenas la
  // pestaña vuelve a estar visible, sin esperar ningún round-trip de red.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        useAdminAuthStore.getState().revisarExpiracion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Admin has no `booting` subscription check — status maps straight off the
  // store: not initialized yet -> booting (blank); no token -> unauthenticated;
  // token present -> authenticated. `i18nReady` is always true here (admin i18n
  // is not gated the way the tenant's pt-BR catalog is).
  const status: AuthStatus = !mounted || !inicializado
    ? 'booting'
    : !token
      ? 'unauthenticated'
      : 'authenticated';

  // En admin.turnetto.com las URLs son limpias (/, /login). Fuera de ahí
  // (localhost, app.turnetto.com/admin) el panel vive bajo /admin y su login es
  // /admin/login: el /login a secas es el del salón, y mandar ahí al admin hacía
  // un bucle con la guarda del salón cuando había una sesión de salón abierta.
  const prefijo = tienePrefijoAdmin(pathname) ? '/admin' : '';

  const route = resolveAuthRoute(
    { status, i18nReady: true },
    { pathname, search: '' },
    classifyAdmin,
    // Admin has no `/agenda` — an authenticated admin landing on its login
    // goes to its own home (task 5.3, reconciles the D2 deviation from Slice 2).
    { home: prefijo || '/', login: `${prefijo}/login` },
  );
  const redirectTo = route.type === 'redirect' ? route.to : null;

  useEffect(() => {
    if (redirectTo) router.push(redirectTo);
  }, [redirectTo, router]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      {route.type === 'allow' ? children : null}
      {route.type === 'allow' && reautenticacionRequerida && <AdminReauthModal />}
    </div>
  );
}
