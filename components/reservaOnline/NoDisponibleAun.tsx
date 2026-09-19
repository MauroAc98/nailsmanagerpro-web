'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { IcoCandado } from './iconos';

// El kill switch del backend (RESERVAS_CREACION_HABILITADA) esta apagado:
// ninguna de las 5 escrituras funciona todavia. Se muestra a pantalla
// completa (nunca se confunde con un hold vencido o un horario tomado, que
// SI dejan seguir reservando) porque no hay nada para hacer en el flujo.
export function NoDisponibleAun() {
  const t = useTranslations('reservaOnline.errores');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '70px 12px 0' }}>
      <div style={{ width: 84, height: 84, borderRadius: 42, background: colors.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IcoCandado color={colors.amberFg} size={36} />
      </div>
      <h1 style={{ margin: '22px 0 8px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, color: colors.strong }}>
        {t('noDisponibleTitulo')}
      </h1>
      <div style={{ fontSize: 14.5, color: colors.sub, lineHeight: 1.5 }}>{t('noDisponibleDetalle')}</div>
    </div>
  );
}
