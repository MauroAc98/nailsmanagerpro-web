'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

// Marca de una tarjeta de agenda cuyo turno trae una nota del cliente (la idea
// que escribio al reservar online). Mismo tamaño y lugar que el badge de
// "Reserva online", en ambar para distinguirlo; solo icono para no comerle ancho al nombre.
export function IconoNotaTurno() {
  const t = useTranslations('agenda.NotaTurno');
  return (
    <span
      role="img"
      aria-label={t('chip')}
      title={t('chip')}
      style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: 3, borderRadius: 6,
        color: colors.amberFg, background: colors.amberBg,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
        <path d="M5.5 6.5h5M5.5 8.5h3" />
      </svg>
    </span>
  );
}

// true si el turno trae una nota con texto (una en blanco no cuenta).
export const tieneNotaTurno = (notas?: string | null): boolean => !!notas && notas.trim() !== '';
