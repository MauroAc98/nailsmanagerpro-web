'use client';

import { useTranslations } from 'next-intl';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { useProAuthStore } from '@/store/useProAuthStore';

// Pantalla de "portal no disponible": el API del portal respondió 404 (portal
// apagado) o `me` no se pudo cargar. NO cierra la sesión: reintentar vuelve a
// leer el storage y, si hay una sesión guardada, a pedir `me`.
export function PortalNoDisponible() {
  const t = useTranslations('profesionales.PortalNoDisponible');
  // Con una sesión guardada, "Reintentar" puede no salir nunca de acá (un fallo
  // persistente de `me`): cerrar sesión es la salida, no un callejón de 30 días.
  const haySesion = useProAuthStore((s) => s.token !== null);

  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
        backgroundColor: agendaColors.bg,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong }}>{t('titulo')}</h1>
      <p style={{ margin: 0, fontSize: 15, color: agendaColors.sub, maxWidth: 320 }}>{t('descripcion')}</p>
      <button
        type="button"
        onClick={() => useProAuthStore.getState().inicializar()}
        style={{
          minHeight: 44,
          marginTop: 8,
          padding: '0 24px',
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          backgroundColor: agendaColors.primarySolid,
          color: agendaColors.primaryFg,
        }}
      >
        {t('reintentar')}
      </button>
      {haySesion && (
        <button
          type="button"
          onClick={() => void useProAuthStore.getState().logout()}
          style={{
            minHeight: 44,
            padding: '0 24px',
            border: `1px solid ${agendaColors.border}`,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: agendaColors.sub,
          }}
        >
          {t('cerrarSesion')}
        </button>
      )}
    </main>
  );
}
