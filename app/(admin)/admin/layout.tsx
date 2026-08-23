'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { colors } from '@/theme/colors';

// El route group (admin) no agrega segmento a la URL — el segmento
// literal "admin" es lo que hace que todo esto viva bajo /admin/*. Ver
// design admin-panel, tabla "File Changes".
const ADMIN_PUBLIC_PATHS = ['/admin/login'];

function esRutaAdminPublica(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

// Guard propio del panel admin — deliberadamente NO vive en
// app/providers.tsx (ver esRutaAdmin() ahí, que se limita a no interferir
// con esta ruta). Usa su propio store (useAdminAuthStore) y su propia
// clave de sesión (admin_token vía adminService), aislados de la sesión
// tenant. Ver design admin-panel decisión #7.
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

  useEffect(() => {
    if (!mounted || !inicializado) return;

    if (!token) {
      if (!esRutaAdminPublica(pathname)) router.push('/admin/login');
      return;
    }

    if (esRutaAdminPublica(pathname)) router.push('/admin');
  }, [mounted, inicializado, token, pathname, router]);

  // Mismo criterio de cálculo-en-render que app/providers.tsx: decide con
  // lo que YA sabemos si esta ruta es válida para el estado de sesión
  // admin actual, para no dejar parpadear contenido protegido un instante
  // antes de que el efecto de arriba redirija.
  const rutaEsPublica = esRutaAdminPublica(pathname);
  let puedeMostrarContenido: boolean;
  if (!mounted || !inicializado) {
    puedeMostrarContenido = false;
  } else if (!token) {
    puedeMostrarContenido = rutaEsPublica;
  } else {
    puedeMostrarContenido = !rutaEsPublica;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      {puedeMostrarContenido ? children : null}
    </div>
  );
}
