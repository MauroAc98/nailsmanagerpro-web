'use client';

import { useTranslations } from 'next-intl';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import type { BookableService, ProfesionalPublico } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { EtiquetaPromo, PasosPromo, PastillaModo } from './PromoIncluye';
import { Avatar } from './ui';

// Los servicios de un turno, uno por fila: nombre, duracion a la derecha y,
// debajo, quien lo hace (foto o inicial). Una promo con servicios adentro se
// lista con su "Incluye" (pasos con duracion y profesional) y el total. Lo usan
// el resumen previo al pago y el comprobante de la reserva confirmada.
export function ServiciosDelTurno({
  servicios,
  profesionalDe,
}: {
  servicios: BookableService[];
  // Quien hace ese servicio (undefined = no se sabe: la fila va sin persona).
  profesionalDe: (servicioId: number) => ProfesionalPublico | undefined;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {servicios.map((s) => {
        if (s.promoComponentizada && s.componentes && s.componentes.length > 0) {
          const paralelo = s.modoPromo === 'paralelo';
          return (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, color: colors.strong, overflowWrap: 'anywhere' }}>{s.nombre}</span>
                <EtiquetaPromo />
              </div>
              <div style={{ background: colors.surface2, borderRadius: 12, padding: '12px 14px', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: colors.sub, textTransform: 'uppercase' }}>
                    {t('servicios.incluye')}
                  </span>
                  <PastillaModo paralelo={paralelo} />
                </div>
                <PasosPromo componentes={s.componentes} paralelo={paralelo} detallado />
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10,
                    borderTop: `1px solid ${colors.hairline}`, fontSize: 13, color: colors.sub,
                  }}
                >
                  <span>{t('resumen.enTotal')}</span>
                  <b style={{ color: colors.strong }}>{formatearDuracion(s.duracionMinutos)}</b>
                </div>
              </div>
            </div>
          );
        }
        const quien = profesionalDe(s.id);
        return (
          <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, color: colors.strong, overflowWrap: 'anywhere' }}>{s.nombre}</div>
              {quien && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                  <Avatar nombre={quien.nombre} size={26} fotoUrl={quien.avatarUrl} />
                  <span style={{ fontSize: 12.5, color: colors.sub, overflowWrap: 'anywhere', minWidth: 0 }}>
                    {t('resumen.conPersona', { profesional: quien.nombre })}
                  </span>
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, color: colors.sub, whiteSpace: 'nowrap', paddingTop: 1 }}>{formatearDuracion(s.duracionMinutos)}</span>
          </div>
        );
      })}
    </div>
  );
}
