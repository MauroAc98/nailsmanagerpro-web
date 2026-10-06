'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { Tarjeta } from './ui';

// Se muestra en Configuración > Reservas online a quien todavía no tiene el
// add-on: lo activa el equipo desde el panel de admin, así que la salida es
// escribirnos por WhatsApp (mismo número de soporte que el aviso de renovación).
export function ContactanosReservaOnline() {
  const t = useTranslations('reservaOnline.contactanos');
  const { supportInfo } = useAuth();

  const contactar = () => {
    if (!supportInfo?.whatsapp) return;
    const numero = supportInfo.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(t('mensaje'))}`, '_blank');
  };

  return (
    <Tarjeta>
      <div style={{ fontFamily: agendaFontSerif, fontSize: 18, color: colors.textStrong }}>{t('titulo')}</div>
      <p style={{ fontSize: 14, color: colors.subtext, margin: '6px 0 0' }}>{t('descripcion')}</p>
      {supportInfo?.whatsapp && (
        <button
          type="button"
          onClick={contactar}
          style={{
            marginTop: 14,
            padding: '10px 16px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.textStrong,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('boton')}
        </button>
      )}
    </Tarjeta>
  );
}
