'use client';

import { useLocale, useTranslations } from 'next-intl';
import { getService, reservaOnlineHabilitada } from '@/lib/reservaOnline';
import { diaLargoCorto } from '@/lib/reservaOnline/formatoFecha';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCarga } from './hooks';

const VENTANA_AVISO_MS = 24 * 60 * 60_000;

// Aviso de la Agenda: "X reservo y pago la sena" para la reserva online mas
// reciente pagada en las ultimas 24 h. Oculto con la flag apagada. En el
// slice 1 las reservas salen del mock (listOnlineBookings).
export function AvisoReservaOnline({ ahora = Date.now }: { ahora?: () => number }) {
  const habilitada = reservaOnlineHabilitada();
  const t = useTranslations('reservaOnline.agenda');
  const locale = useLocale();
  const { data } = useCarga(
    () => (habilitada ? getService().listOnlineBookings() : Promise.resolve([])),
    habilitada ? 'on' : 'off',
  );

  const ultima = habilitada ? data?.[0] : undefined;
  if (!ultima || ahora() - ultima.pagadaAtMs > VENTANA_AVISO_MS) return null;

  return (
    <div style={{ padding: '0 20px' }}>
      <div
        role="status"
        style={{
          background: colors.successBg,
          border: `1px solid ${colors.successBorder}`,
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          aria-hidden="true"
          style={{ width: 34, height: 34, borderRadius: 17, background: colors.primarySolid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primaryFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.strong }}>
            {t('aviso', { nombre: ultima.clienteNombre })}
          </div>
          <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 2 }}>
            {t('avisoDetalle', { fecha: diaLargoCorto(ultima.fecha, locale), hora: ultima.hora })}
          </div>
        </div>
      </div>
    </div>
  );
}
