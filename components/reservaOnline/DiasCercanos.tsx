'use client';

import { useLocale, useTranslations } from 'next-intl';
import { diasEntre } from '@/lib/reservaOnline/diasCercanos';
import { diaLargoCorto } from '@/lib/reservaOnline/formatoFecha';
import type { Fecha } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';

export interface DiaCercano {
  fecha: Fecha;
  // Primer inicio libre de ese dia; null mientras se consulta.
  hora: string | null;
  // "Con Ana" cuando la eleccion es una profesional puntual (null = cualquiera).
  quien: string | null;
}

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Cuando el dia elegido no tiene horarios: hasta dos opciones, el dia con lugar
// mas cercano ANTES y DESPUES (dentro de la ventana reservable). Tocar una salta
// a ese dia; con una sola opcion ocupa todo el ancho.
export function DiasCercanos({
  fecha,
  antes,
  despues,
  onElegir,
}: {
  fecha: Fecha;
  antes: DiaCercano | null;
  despues: DiaCercano | null;
  onElegir: (fecha: Fecha) => void;
}) {
  const t = useTranslations('reservaOnline.horario');
  const locale = useLocale();
  const opciones = [
    antes && { ...antes, lado: 'antes' as const },
    despues && { ...despues, lado: 'despues' as const },
  ].filter((o): o is NonNullable<typeof o> => !!o);

  return (
    <div>
      <p style={{ fontSize: 14, lineHeight: 1.5, margin: '12px 0 10px', color: colors.sub }}>{t('sinHorariosCercanos')}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {opciones.map((o) => {
          const resaltada = o.lado === 'despues';
          const n = diasEntre(fecha, o.fecha);
          return (
            <button
              key={o.lado}
              type="button"
              data-testid={`cercano-${o.lado}`}
              onClick={() => onElegir(o.fecha)}
              style={{
                flex: 1, minWidth: 0, minHeight: 44, textAlign: 'left', cursor: 'pointer', padding: '12px',
                borderRadius: 16, color: colors.strong,
                border: `1.5px solid ${resaltada ? colors.primarySolid : colors.border}`,
                background: resaltada ? colors.primarySoft : colors.surface,
              }}
            >
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.sub }}>
                {t(o.lado === 'antes' ? 'cercanoAntes' : 'cercanoDespues')}
              </span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                {capitalizar(diaLargoCorto(o.fecha, locale))}
              </span>
              {o.hora && <span style={{ display: 'block', fontSize: 14, marginTop: 1 }}>{o.hora}</span>}
              <span style={{ display: 'block', fontSize: 12, color: colors.sub, marginTop: 4 }}>
                {o.quien ? `${o.quien} · ` : ''}
                {t(o.lado === 'antes' ? 'diasAntes' : 'diasDespues', { n })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
