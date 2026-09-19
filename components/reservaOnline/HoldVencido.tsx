'use client';

import { useTranslations } from 'next-intl';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import type { Ir } from './hooks';
import { IcoReloj } from './iconos';
import { BarraInferior, BotonPrimario } from './ui';

// La retencion del horario vencio mientras la clienta completaba datos o
// revisaba el resumen: nunca se la deja llegar al pago con un hold vencido.
// "Elegir otro horario" suelta la hora (conserva servicios, profesional y dia)
// y vuelve al paso de horarios, que vuelve a pedir la disponibilidad.
export function HoldVencido({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline.hold');
  const elegirOtro = () => {
    useReservaOnlineStore.getState().limpiarHorario();
    ir(rutaPaso(slug, 'horario'));
  };
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '70px 12px 0' }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, background: colors.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcoReloj color={colors.amberFg} size={40} />
        </div>
        <h1 style={{ margin: '22px 0 8px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, color: colors.strong }}>
          {t('vencidoTitulo')}
        </h1>
        <div style={{ fontSize: 14.5, color: colors.sub, lineHeight: 1.5 }}>{t('vencidoDetalle')}</div>
      </div>
      <BarraInferior>
        <BotonPrimario onClick={elegirOtro}>{t('elegirOtro')}</BotonPrimario>
      </BarraInferior>
    </div>
  );
}
