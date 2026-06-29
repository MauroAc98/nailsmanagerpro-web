'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, inicializado, debeCambiarPassword, subscriptionExpired } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Inicializar auth al montar
  useEffect(() => {
    useAuthStore.getState().inicializar();
    setMounted(true);
  }, []);

  // Manejar redirecciones según estado de auth
  useEffect(() => {
    if (!mounted || !inicializado) return;

    // No autenticado
    if (!token) {
      if (!pathname.startsWith('/(auth)') && pathname !== '/login' && pathname !== '/forgot-password' && pathname !== '/reset-password') {
        router.push('/login');
      }
      return;
    }

    // Debe cambiar contraseña
    if (debeCambiarPassword) {
      if (pathname !== '/cambiar-password') {
        router.push('/cambiar-password');
      }
      return;
    }

    // Suscripción vencida
    if (subscriptionExpired) {
      if (pathname !== '/subscription-expired') {
        router.push('/subscription-expired');
      }
      return;
    }

    // Autenticado y activo → no debe estar en pantallas de auth
    if (pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password') {
      router.push('/agenda');
    }
  }, [mounted, inicializado, token, debeCambiarPassword, subscriptionExpired, pathname, router]);

  return <>{children}</>;
}