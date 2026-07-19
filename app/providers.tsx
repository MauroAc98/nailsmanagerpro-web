'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLoadingStore } from '@/store/useLoadingStore';
import { Loader } from '@/components/Loader';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ConfirmSheetHost } from '@/components/ConfirmSheetHost';
import { ToastHost } from '@/components/ToastHost';

// Rutas accesibles sin sesión que además redirigen a /agenda si ya hay token
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
// Rutas accesibles sin sesión que nunca fuerzan redirect (independientes del estado de auth)
const NEUTRAL_PATHS = ['/legal'];

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
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, inicializado, debeCambiarPassword, subscriptionExpired, mostrarBienvenida } = useAuthStore();
  const isLoading = useLoadingStore(state => state.isLoading);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    useAuthStore.getState().inicializar();
    setMounted(true);
  }, []);

  // Escucha eventos del interceptor de Axios (evita dependencia circular api ↔ store)
  useEffect(() => {
    const onSessionExpired      = () => useAuthStore.setState(CLEARED_AUTH_STATE);
    const onSubscriptionExpired = () => useAuthStore.getState().setSubscriptionExpired(true);

    window.addEventListener('session-expired',      onSessionExpired);
    window.addEventListener('subscription-expired', onSubscriptionExpired);
    return () => {
      window.removeEventListener('session-expired',      onSessionExpired);
      window.removeEventListener('subscription-expired', onSubscriptionExpired);
    };
  }, []);

  useEffect(() => {
    if (!mounted || !inicializado) return;

    if (!token) {
      // Sin token pero con cambio de password pendiente → el usuario está en el flujo de primer login
      if (debeCambiarPassword) {
        if (pathname !== '/cambiar-password') router.push('/cambiar-password');
        return;
      }
      if (!PUBLIC_PATHS.includes(pathname) && !NEUTRAL_PATHS.includes(pathname)) {
        router.push('/login');
      }
      return;
    }

    if (subscriptionExpired) {
      if (pathname !== '/subscription-expired') router.push('/subscription-expired');
      return;
    }

    if (PUBLIC_PATHS.includes(pathname)) {
      router.push('/agenda');
    }
  }, [mounted, inicializado, token, debeCambiarPassword, subscriptionExpired, pathname, router]);

  // Calculado en el render, no en el efecto: si dejáramos que {children} se
  // muestre siempre, la página protegida (ej. agenda) alcanza a pintarse un
  // instante antes de que el efecto de arriba corra y redirija — el flash
  // que se veía. Acá decidimos, con lo que YA sabemos, si esta ruta es
  // válida para el estado de auth actual; si no, mostramos blanco mientras
  // el efecto hace la redirección real.
  const esRutaPublica = PUBLIC_PATHS.includes(pathname);
  const esRutaNeutral = NEUTRAL_PATHS.includes(pathname);

  let puedeMostrarContenido: boolean;
  if (esRutaNeutral) {
    puedeMostrarContenido = true;
  } else if (!mounted || !inicializado) {
    puedeMostrarContenido = false;
  } else if (!token) {
    puedeMostrarContenido = debeCambiarPassword
      ? pathname === '/cambiar-password'
      : esRutaPublica;
  } else if (subscriptionExpired) {
    puedeMostrarContenido = pathname === '/subscription-expired';
  } else {
    puedeMostrarContenido = !esRutaPublica;
  }

  return (
    <>
      {puedeMostrarContenido ? children : <div style={{ minHeight: '100vh', backgroundColor: '#fff' }} />}
      <Loader visible={isLoading} />
      {mostrarBienvenida && <WelcomeScreen />}
      <ConfirmSheetHost />
      <ToastHost />
    </>
  );
}