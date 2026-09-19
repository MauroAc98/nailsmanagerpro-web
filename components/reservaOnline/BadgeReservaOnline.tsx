'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

// Etiqueta de turno originado en la reserva online (tablero AgendaProfesional).
export function BadgeReservaOnline() {
  const t = useTranslations('reservaOnline.agenda');
  return (
    <span
      style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: colors.primaryDeep, background: colors.primarySoft,
        borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      {t('badge')}
    </span>
  );
}
