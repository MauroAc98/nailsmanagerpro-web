'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import type { EstadoReservaOnline } from '@/lib/promoEstadoOnline';

// Top card of the edit screen: honest, plain status of online booking. Only
// the blocking case is red; "not yet bookable online" is calm information.
export default function EstadoReservaOnlineCard({ estado, onIrAHorarios }: {
  estado: EstadoReservaOnline; onIrAHorarios: () => void;
}) {
  const t = useTranslations('configuracion.ComponentesPromoSection');
  const locale = useLocale();
  const bloqueo = estado.tipo === 'bloqueo';
  const servicio = bloqueo ? (estado.servicio ?? t('thisService')) : '';
  const nombre = bloqueo ? (estado.nombre || t('thisPerson')) : '';

  const Icono = bloqueo ? CircleAlert : estado.tipo === 'ok' ? CircleCheck : Info;
  const colorIcono = bloqueo ? colors.dangerBorder : estado.tipo === 'ok' ? colors.success : colors.subtext;
  const colorTexto = bloqueo ? colors.dangerBorder : colors.subtext;

  let titulo: string;
  let cuerpo: string;
  if (estado.tipo === 'ok') {
    titulo = t('onlineOkTitle');
    cuerpo = t('onlineOkBody', { nombres: new Intl.ListFormat(locale, { type: 'conjunction' }).format(estado.nombres) });
  } else if (estado.tipo === 'pendiente') {
    titulo = t('onlinePendingTitle');
    cuerpo = estado.ejemplo
      ? t('onlinePendingBody', { a: estado.ejemplo.a, hora: estado.ejemplo.hora, b: estado.ejemplo.b, requerida: estado.ejemplo.requerida })
      : t('onlinePendingGeneric');
  } else {
    titulo = t(estado.motivo === 'inactiva' ? 'blockInactiveTitle' : 'blockUnlinkedTitle', { nombre, servicio });
    cuerpo = t(estado.motivo === 'inactiva' ? 'blockInactiveBody' : 'blockUnlinkedBody', { servicio });
  }

  return (
    <div style={{
      display: 'flex', gap: 10, borderRadius: 14, padding: '13px 14px',
      backgroundColor: bloqueo ? colors.dangerBg : colors.surface,
      border: `1px solid ${bloqueo ? colors.dangerBorder : colors.border}`,
      boxShadow: bloqueo ? 'none' : shadows.card,
    }}>
      <Icono size={20} color={colorIcono} style={{ flexShrink: 0 }} aria-hidden="true" />
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: bloqueo ? colors.dangerBorder : colors.textStrong }}>{titulo}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: colorTexto, lineHeight: 1.4 }}>{cuerpo}</p>
        {estado.tipo === 'pendiente' && (
          <button type="button" onClick={onIrAHorarios} style={{
            margin: '8px 0 0', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: colors.primaryDeep,
          }}>
            {t('goToHorarios')}
          </button>
        )}
      </div>
    </div>
  );
}
