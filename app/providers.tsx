'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLoadingStore } from '@/store/useLoadingStore';
import { Loader } from '@/components/Loader';

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
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, inicializado, debeCambiarPassword, subscriptionExpired } = useAuthStore();
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
      if (pathname !== '/login' && pathname !== '/forgot-password' && pathname !== '/reset-password') {
        router.push('/login');
      }
      return;
    }

    if (subscriptionExpired) {
      if (pathname !== '/subscription-expired') router.push('/subscription-expired');
      return;
    }

    if (pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password') {
      router.push('/agenda');
    }
  }, [mounted, inicializado, token, debeCambiarPassword, subscriptionExpired, pathname, router]);

  return (
    <>
      {children}
      <Loader visible={isLoading} />
    </>
  );
}