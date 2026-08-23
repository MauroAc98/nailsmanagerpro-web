'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, RefreshCw, Settings } from 'lucide-react';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { colors, shadows } from '@/theme/colors';

// Landing mínima del shell admin — no está en la lista literal de tasks
// 3.1-3.9, pero sin una página bajo /admin el guard de layout.tsx no tiene
// a dónde redirigir tras un login exitoso. Phase 4 agregó el link de
// creación de negocio; Phase 5 suma el de búsqueda/renovación de
// suscripciones acá mismo.
export default function AdminHomePage() {
  const router = useRouter();
  const { admin, logout } = useAdminAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Panel de administración</h1>
      <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
        {admin ? `Sesión activa: ${admin.name} (${admin.email})` : 'Sesión activa'}
      </p>

      <Link
        href="/negocios/nuevo"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          borderRadius: 16,
          backgroundColor: colors.surface,
          boxShadow: shadows.card,
          border: `1px solid ${colors.border}`,
          textDecoration: 'none',
          maxWidth: 320,
        }}
      >
        <Building2 size={20} color={colors.primaryDeep} strokeWidth={1.5} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0 }}>Crear negocio</p>
          <p style={{ fontSize: 12, color: colors.subtext, margin: 0 }}>Dar de alta un nuevo negocio y su profesional</p>
        </div>
      </Link>

      <Link
        href="/suscripciones"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          borderRadius: 16,
          backgroundColor: colors.surface,
          boxShadow: shadows.card,
          border: `1px solid ${colors.border}`,
          textDecoration: 'none',
          maxWidth: 320,
        }}
      >
        <RefreshCw size={20} color={colors.primaryDeep} strokeWidth={1.5} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0 }}>Suscripciones</p>
          <p style={{ fontSize: 12, color: colors.subtext, margin: 0 }}>Buscar un negocio y renovar su suscripción</p>
        </div>
      </Link>

      <Link
        href="/configuracion"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          borderRadius: 16,
          backgroundColor: colors.surface,
          boxShadow: shadows.card,
          border: `1px solid ${colors.border}`,
          textDecoration: 'none',
          maxWidth: 320,
        }}
      >
        <Settings size={20} color={colors.primaryDeep} strokeWidth={1.5} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0 }}>Configuración</p>
          <p style={{ fontSize: 12, color: colors.subtext, margin: 0 }}>Ajustes globales del panel</p>
        </div>
      </Link>

      <button
        onClick={handleLogout}
        style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 12, border: 'none', backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
