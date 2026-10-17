'use client';

import { useTranslations } from 'next-intl';
import { infoEstado } from '@/lib/pro/estado';
import { horaDe, horaFin } from '@/lib/pro/fechaHora';
import type { ProTurno } from '@/lib/pro/tipos';
import { agendaColors } from '@/theme/agendaColors';

interface Props {
  turno: ProTurno;
  // La navegación al detalle es de quien usa la tarjeta (P9b/P12): acá no se navega.
  onAbrir?: (id: number) => void;
}

const truncar = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

// Tarjeta de solo lectura de un turno del portal. Lee ÚNICAMENTE los campos de la
// lista blanca (ProTurno): no existe ningún camino para mostrar teléfono, precio,
// seña, pagos ni enlaces de contacto. Las notas son texto plano.
export function ProTurnoCard({ turno, onAbrir }: Props) {
  const t = useTranslations('profesionales');
  const inicio = horaDe(turno.fecha_hora);
  const fin = inicio === null ? null : horaFin(inicio, turno.duracion_total_minutos);
  const estado = infoEstado(turno.estado_visual);
  const nombre = [turno.cliente.nombre, turno.cliente.apellido]
    .map((parte) => (typeof parte === 'string' ? parte.trim() : ''))
    .filter((parte) => parte !== '')
    .join(' ');
  const notas = typeof turno.notas === 'string' && turno.notas.trim() !== '' ? turno.notas : null;

  const contenido = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0, fontWeight: 700, fontSize: 16, color: agendaColors.strong }}>
          {inicio === null ? (
            <span>{t('Card.sinHora')}</span>
          ) : fin === null ? (
            <span>{inicio}</span>
          ) : (
            <>
              <span>{inicio}</span>
              <span aria-hidden="true">–</span>
              <span>{fin.hora}</span>
              {fin.diaSiguiente && (
                <span style={{ fontSize: 12, fontWeight: 600, color: agendaColors.sub }}>{t('Card.diaSiguiente')}</span>
              )}
            </>
          )}
        </span>
        <span
          style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: estado.fg, background: estado.bg }}
        >
          {t(`Estado.${estado.clave}`)}
        </span>
      </span>

      <span dir="auto" style={{ ...truncar, display: 'block', fontSize: 16, fontWeight: 600, color: agendaColors.strong, unicodeBidi: 'isolate' }}>
        {nombre === '' ? t('Card.sinNombre') : nombre}
      </span>

      {turno.servicios.length > 0 && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {turno.servicios.map((s) => (
            <span key={s.id} dir="auto" style={{ ...truncar, display: 'block', fontSize: 14, color: agendaColors.sub, unicodeBidi: 'isolate' }}>
              {s.nombre}
            </span>
          ))}
        </span>
      )}

      {turno.promo !== null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 13 }}>
          <span style={{ flexShrink: 0, fontWeight: 600, color: agendaColors.primaryDeep }}>{t('Card.promo')}</span>
          <span dir="auto" style={{ ...truncar, color: agendaColors.sub, unicodeBidi: 'isolate' }}>{turno.promo.nombre}</span>
        </span>
      )}

      {notas !== null && (
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
          <span
            role="img"
            aria-label={t('Card.nota')}
            title={t('Card.nota')}
            style={{ flexShrink: 0, display: 'inline-flex', padding: 3, borderRadius: 6, color: agendaColors.amberFg, background: agendaColors.amberBg }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
              <path d="M5.5 6.5h5M5.5 8.5h3" />
            </svg>
          </span>
          <span
            data-nota="true"
            dir="auto"
            style={{
              flex: 1,
              minWidth: 0,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              unicodeBidi: 'isolate',
              fontSize: 13,
              color: agendaColors.sub,
            }}
          >
            {notas}
          </span>
        </span>
      )}
    </>
  );

  const base = {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 44,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 14px',
    textAlign: 'left',
    borderRadius: 12,
    border: `1px solid ${agendaColors.border}`,
    backgroundColor: agendaColors.surface,
    color: agendaColors.text,
    boxShadow: 'var(--ag-shadow-card, none)',
  } as const;

  if (onAbrir === undefined) return <div style={base}>{contenido}</div>;
  return (
    <button type="button" onClick={() => onAbrir(turno.id)} style={{ ...base, cursor: 'pointer', font: 'inherit' }}>
      {contenido}
    </button>
  );
}
