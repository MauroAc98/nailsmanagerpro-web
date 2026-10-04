'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import PillToggle from '@/components/PillToggle';
import { useAvisosReservas } from '@/hooks/useAvisosReservas';

const ERRORES = {
  unavailable: 'errorUnavailable',
  network: 'errorNetwork',
  generic: 'errorGeneric',
} as const;

function IconCampana() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// Fila de Perfil > Avisos. Contenedor + presentación en uno: la lógica vive en
// useAvisosReservas; acá solo se elige qué mostrar según el estado.
export function FilaAvisosReservas() {
  const t = useTranslations('perfil.AvisosReservas');
  const { estado, trabajando, error, activar, desactivar } = useAvisosReservas();

  const puedeCambiar = estado === 'off' || estado === 'on';
  const explicacion =
    estado === 'ios-needs-install' ? t('iosNeedsInstall')
    : estado === 'unsupported' ? t('unsupported')
    : estado === 'denied' ? t('denied')
    : estado === null ? t('loading')
    : estado === 'on' ? t('subtitleOn')
    : t('subtitleOff');

  return (
    <div style={{ padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, backgroundColor: colors.surfaceSubtle, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <IconCampana />
        </div>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: colors.text }}>
          {t('title')}
        </span>
        {puedeCambiar && (
          <PillToggle
            value={estado === 'on'}
            disabled={trabajando}
            ariaLabel={t('toggleLabel')}
            // onChange recibe el valor nuevo; el click del usuario llega
            // sincrónico hasta requestPermission() dentro de activar().
            onChange={(v) => { void (v ? activar() : desactivar()); }}
          />
        )}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.4, color: colors.subtext, margin: '8px 0 0 44px' }}>
        {explicacion}
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.4, color: colors.danger, margin: '6px 0 0 44px' }}>
          {t(ERRORES[error])}
        </div>
      )}
    </div>
  );
}
