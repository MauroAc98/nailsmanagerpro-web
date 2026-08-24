'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, shadows, withAlpha } from '@/theme/colors';
import { NAV_HEIGHT, NAV_BUBBLE_SIZE, NAV_BUBBLE_POKE, NAV_CLEARANCE, NAV_Z_INDEX } from '@/constants/layout';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { useAuth } from '@/hooks/useAuth';

// NAV_BUBBLE_SIZE/NAV_BUBBLE_POKE/NAV_CLEARANCE/NAV_Z_INDEX vienen de
// constants/layout.ts — cualquier fixed que se posicione relativo al nav
// (FAB, BottomSheet vía bottomOffset, toast) tiene que usar NAV_CLEARANCE.
// El <nav> usa NAV_Z_INDEX para pintarse por encima de sheets/FAB, así el
// bubble tapa lo que haya debajo en vez de dejar un hueco.
const NAV_BUBBLE_INNER = 52;

const TAB_DEFS = [
  {
    path: '/agenda',
    labelKey: 'agenda',
    icon: (active: boolean) => (
      <svg width={active ? 24 : 22} height={active ? 24 : 22} viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth={active ? 2.4 : 2}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    path: '/clientes',
    labelKey: 'clientes',
    icon: (active: boolean) => (
      <svg width={active ? 24 : 22} height={active ? 24 : 22} viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth={active ? 2.4 : 2}>
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
      <svg width={active ? 24 : 22} height={active ? 24 : 22} viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth={active ? 2.4 : 2}>
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    path: '/perfil',
    labelKey: 'perfil',
    icon: (active: boolean) => (
      <svg width={active ? 24 : 22} height={active ? 24 : 22} viewBox="0 0 24 24" fill="none" stroke={active ? colors.primaryDeep : colors.muted} strokeWidth={active ? 2.4 : 2}>
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
  const { fetchPendientes } = usePendientesDeCobroStore();
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
      <div style={{
        flex: 1,
        overflow: 'auto',
        // NAV_CLEARANCE = barra + margen + lo que el bubble activo sobresale
        // por arriba — el tab activo "explota" hacia arriba pero eso no le
        // come espacio al contenido, solo dibuja por encima del padding.
        paddingBottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom))`,
      }}>
        {children}
      </div>

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        // Sin height fija acá: con box-sizing: border-box (Tailwind preflight)
        // un height:78 + paddingBottom:env(...) hace que el safe area le robe
        // alto al contenido en vez de sumarse. Bug real visto en Safari/iOS
        // (2026-08-24): forzar boxSizing: 'content-box' acá para poder fijar
        // height igual funcionaba en Chrome pero en Safari el nav terminaba
        // más alto de lo esperado — el contenido (íconos+label) quedaba
        // corrido hacia arriba, con un hueco de más antes del home indicator.
        // Volver al patrón anterior (altura fija en cada BOTÓN, no acá) evita
        // depender de ese override, que es justo el tipo de propiedad con
        // soporte más inconsistente entre motores de render.
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Solo arriba — pegada al borde de pantalla (NAV_MARGIN=0), no una
        // pill flotante. Ver el comment de NAV_MARGIN en constants/layout.ts:
        // esto es lo que hace que el nav y cualquier BottomSheet/FAB debajo
        // compartan la misma geometría (mismo ancho, mismo offset), en vez
        // de tener que mantener sideInset/NAV_CLEARANCE sincronizados a mano.
        // 20px, no un valor propio — mismo radius que usa BottomSheet.tsx
        // (components/BottomSheet.tsx, compartido por todos los sheets de
        // la app). Con radius distinto (era 28), el radio más chico del
        // sheet detrás asomaba en la esquina, por afuera de la curva más
        // cerrada de la barra — con el mismo radius las dos curvas coinciden
        // exactas y no queda nada asomando.
        borderRadius: '20px 20px 0 0',
        backgroundColor: colors.surface,
        boxShadow: shadows.sheet,
        display: 'flex',
        alignItems: 'center',
        // overflow visible a propósito: el bubble del tab activo se dibuja
        // por afuera del rectángulo de la barra (top negativo) — si se
        // recorta acá, se corta el círculo flotante.
        overflow: 'visible',
        // Por encima de BottomSheet/FAB (ver NAV_Z_INDEX) — así el bubble,
        // que asoma justo en la franja donde un sheet abierto también
        // llega (bottomOffset={NAV_CLEARANCE}, flush con la barra), se
        // pinta arriba del sheet en vez de quedar tapado por él.
        zIndex: NAV_Z_INDEX,
      }}>
        {TABS.map((tab) => {
          const active = pathname === tab.path || pathname.startsWith(tab.path + '/');
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
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
            >
              {active ? (
                // Bubble flotante: el color va en el disco interior, no en
                // un borde. El halo exterior "surface" casi no se nota en
                // tema oscuro (surface #1e1e22 vs background #16161a son
                // casi el mismo tono) — le sumo un border fino en
                // colors.border para que el círculo tenga un borde
                // definido en los dos temas, no solo boxShadow.
                // El disco interior también estaba roto en oscuro: 22% de
                // primary mezclado sobre un surface ya oscuro da un verde
                // casi invisible (contraste real ~8-10%, se ve como "nada"
                // — de ahí el reporte de que el panel "no se agranda"/se ve
                // cortado, cuando en realidad estaba ahí pero invisible).
                // Subido a 55% para que el tinte se note en los dos temas.
                // nav-bubble-enter: la animation de entrada (definida en
                // globals.css) es lo que hace la transición suave — un CSS
                // transition normal no serviría, este div recién se monta en
                // cada cambio de ruta (no hay un "antes" que interpolar).
                <div className="nav-bubble-enter" style={{
                  position: 'absolute',
                  top: -NAV_BUBBLE_POKE,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: NAV_BUBBLE_SIZE,
                  height: NAV_BUBBLE_SIZE,
                  borderRadius: '50%',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: NAV_BUBBLE_INNER,
                    height: NAV_BUBBLE_INNER,
                    borderRadius: '50%',
                    backgroundColor: withAlpha(colors.primary, '8c'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {tab.icon(true)}
                  </div>
                </div>
              ) : (
                <div className="nav-icon-enter" style={{ position: 'relative' }}>
                  {tab.icon(false)}
                </div>
              )}
              <span style={{
                fontSize: 11,
                color: active ? colors.primaryDeep : colors.subtext,
                fontWeight: active ? 700 : 400,
                marginTop: active ? NAV_BUBBLE_SIZE - 30 : 0,
                // Mismo elemento en los dos estados (no se remonta al
                // cambiar de tab) — acá un transition normal sí interpola:
                // el salto de posición/color queda suave en vez de golpe.
                transition: 'margin-top 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}