'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { NAV_HEIGHT } from '@/constants/layout';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { useAuth } from '@/hooks/useAuth';

const TAB_DEFS = [
  {
    path: '/agenda',
    labelKey: 'agenda',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? colors.primaryDeep : 'none'} stroke={active ? colors.primaryDeep : colors.muted} strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    path: '/clientes',
    labelKey: 'clientes',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/configuracion',
    labelKey: 'config',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    path: '/perfil',
    labelKey: 'perfil',
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav.AppLayout');
  const { pendientes, fetchPendientes } = usePendientesDeCobroStore();
  const { fetchRecordatoriosPendientes } = useRecordatoriosPendientesStore();
  const { fetchNotificaciones } = useNotificacionesStore();
  const { checkSubscription } = useAuth();

  useEffect(() => {
    // checkSubscription reconcilia whatsapp_requiere_envio_manual contra el
    // backend (puede haber cambiado por un cron mientras la sesión seguía
    // abierta) — hay que esperarlo antes de fetchRecordatoriosPendientes,
    // que decide si pedir algo leyendo ese mismo flag desde el store.
    const refrescar = async () => {
      fetchPendientes();
      await checkSubscription();
      fetchRecordatoriosPendientes();
      fetchNotificaciones();
    };
    refrescar();
    // El cron que autocompleta turnos corre server-side sin avisar al cliente —
    // re-consultamos al volver a primer plano (typical PWA: se abre/cierra todo
    // el tiempo) en vez de pollear de fondo y gastar batería sin necesidad.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refrescar();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkSubscription, fetchPendientes, fetchRecordatoriosPendientes, fetchNotificaciones]);

  const TABS = TAB_DEFS.map(tab => ({ ...tab, label: t(tab.labelKey) }));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}>
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
          const mostrarBadge = tab.path === '/agenda' && pendientes.length > 0;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              style={{
                flex: 1,
                height: NAV_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                borderTop: active ? `3px solid ${colors.primaryDeep}` : '3px solid transparent',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative' }}>
                {tab.icon(active)}
                {mostrarBadge && (
                  <span
                    onClick={e => { e.stopPropagation(); router.push('/pendientes-de-cobro'); }}
                    aria-label={t('pendingCobroAriaLabel')}
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.amber,
                      color: '#FFF',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      cursor: 'pointer',
                    }}
                  >
                    {pendientes.length > 99 ? '99+' : pendientes.length}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: active ? colors.primaryDeep : colors.subtext, fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}