'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { resolveAuthRoute, type AuthStatus } from '@/lib/resolveAuthRoute';
import { classifyAdmin } from '@/lib/authRouteClasses';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
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
  const { token, inicializado, inicializar } = useAdminAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    inicializar();
    setMounted(true);
  }, [inicializar]);

  // Evento del interceptor de lib/adminApi.ts — evita dependencia circular
  // adminApi ↔ store, mismo patrón que 'session-expired' en
  // app/providers.tsx. Completamente aislado de ese: un 401 admin nunca
  // toca useAuthStore/auth_token, y viceversa.
  useEffect(() => {
    const onAdminSessionExpired = () =>
      useAdminAuthStore.setState({ admin: null, token: null, error: null });
    window.addEventListener('admin-session-expired', onAdminSessionExpired);
    return () => window.removeEventListener('admin-session-expired', onAdminSessionExpired);
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

  const route = resolveAuthRoute(
    { status, i18nReady: true },
    { pathname, search: '' },
    classifyAdmin,
    // Admin has no `/agenda` — an authenticated admin landing on `/login`
    // goes to `/` (task 5.3, reconciles the D2 deviation from Slice 2).
    { home: '/' },
  );
  const redirectTo = route.type === 'redirect' ? route.to : null;

  useEffect(() => {
    if (redirectTo) router.push(redirectTo);
  }, [redirectTo, router]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      {route.type === 'allow' ? children : null}
    </div>
  );
}
