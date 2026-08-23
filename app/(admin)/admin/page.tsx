'use client';

import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { colors } from '@/theme/colors';

// Landing mínima del shell admin — no está en la lista literal de tasks
// 3.1-3.9, pero sin una página bajo /admin el guard de layout.tsx no tiene
// a dónde redirigir tras un login exitoso (Phase 4/5 agregan
// /admin/negocios/nuevo y /admin/suscripciones; hasta entonces esta es la
// única superficie protegida real para poder probar el flujo end-to-end).
export default function AdminHomePage() {
  const router = useRouter();
  const { admin, logout } = useAdminAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Panel de administración</h1>
      <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
        {admin ? `Sesión activa: ${admin.name} (${admin.email})` : 'Sesión activa'}
      </p>
      <button
        onClick={handleLogout}
        style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 12, border: 'none', backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
