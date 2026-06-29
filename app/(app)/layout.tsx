'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que querés cerrar sesión?')) {
      await logout();
      router.push('/login');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      {/* Contenido */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 70 }}>
        {children}
      </div>

      {/* Barra de navegación inferior */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 70,
          backgroundColor: '#fff',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {/* Agenda */}
        <button
          onClick={() => router.push('/agenda')}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderTop: isActive('/agenda') ? `3px solid #d79ea4` : 'none',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={isActive('/agenda') ? '#d79ea4' : 'none'}
            stroke={isActive('/agenda') ? '#d79ea4' : '#999'}
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <span style={{ fontSize: 11, color: isActive('/agenda') ? '#d79ea4' : '#999', fontWeight: isActive('/agenda') ? 600 : 400 }}>
            Agenda
          </span>
        </button>

        {/* Perfil */}
        <button
          onClick={() => router.push('/perfil')}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderTop: isActive('/perfil') ? `3px solid #d79ea4` : 'none',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={isActive('/perfil') ? '#d79ea4' : 'none'}
            stroke={isActive('/perfil') ? '#d79ea4' : '#999'}
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ fontSize: 11, color: isActive('/perfil') ? '#d79ea4' : '#999', fontWeight: isActive('/perfil') ? 600 : 400 }}>
            Perfil
          </span>
        </button>

        {/* Salir */}
        <button
          onClick={handleLogout}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>
            Salir
          </span>
        </button>
      </nav>
    </div>
  );
}