'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

// Etiqueta de turno originado en la reserva online.
//
// `compacto` = solo el icono, sin el texto: para filas angostas donde
// compite por ancho con el nombre de la clienta (la card de agenda —
// bug real: el badge con texto le dejaba muy poco lugar al nombre en la
// misma fila, ver pattern-flex-minwidth-long-names). Sin `compacto`, el
// texto completo — para donde sobra espacio (la pantalla de editar turno)
// y vale la pena que el origen quede explicito, no solo un icono.
export function BadgeReservaOnline({ compacto = false }: { compacto?: boolean }) {
  const t = useTranslations('reservaOnline.agenda');
  return (
    <span
      {...(compacto ? { role: 'img', 'aria-label': t('badge'), title: t('badge') } : {})}
      style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: colors.primaryDeep, background: colors.primarySoft,
        borderRadius: 6, padding: compacto ? 3 : '2px 6px', whiteSpace: 'nowrap',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      {!compacto && t('badge')}
    </span>
  );
}
