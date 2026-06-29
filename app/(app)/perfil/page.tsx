'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function PerfilPage() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que querés cerrar sesión?')) {
      await logout();
      router.push('/login');
    }
  };

  return (
    <div style={{ padding: '24px', paddingBottom: '100px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#333', marginBottom: 16 }}>
        Perfil
      </h1>

      <div style={{ backgroundColor: '#f5f5f5', padding: 24, borderRadius: 12, textAlign: 'center', marginBottom: 24 }}>
        <p style={{ color: '#999' }}>
          La sección de perfil se está desarrollando...
        </p>
      </div>

      <button
        onClick={handleLogout}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 14,
          backgroundColor: 'transparent',
          border: '1px solid #EEE',
          color: '#999',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
