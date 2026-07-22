'use client';

import { useRouter, usePathname } from 'next/navigation';
import { colors } from '@/theme/colors';

const TABS = [
  {
    path: '/agenda',
    label: 'Agenda',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? colors.primary : 'none'} stroke={active ? colors.primary : colors.muted} strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    path: '/clientes',
    label: 'Clientes',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primary : colors.muted} strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/configuracion',
    label: 'Config',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primary : colors.muted} strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    path: '/perfil',
    label: 'Perfil',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primary : colors.muted} strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 'calc(78px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        // Sin height fija acá: con box-sizing: border-box (Tailwind preflight)
        // un height:78 + paddingBottom:env(...) hace que el safe area le robe
        // alto al contenido en vez de sumarse — en el home indicator de
        // iPhone (~34px) los botones quedaban apretados contra el borde. Los
        // 78px van en cada botón (abajo); acá el padding solo agrega el
        // safe area por encima de esa altura de contenido.
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
      }}>
        {TABS.map((tab) => {
          const active = pathname === tab.path || pathname.startsWith(tab.path + '/');
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              style={{
                flex: 1,
                height: 78,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                borderTop: active ? `3px solid ${colors.primary}` : '3px solid transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {tab.icon(active)}
              <span style={{ fontSize: 12, color: active ? colors.primary : colors.subtext, fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}