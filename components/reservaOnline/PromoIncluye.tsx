'use client';

import { useTranslations } from 'next-intl';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import type { ComponentePromo } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { Avatar } from './ui';

// Etiqueta PROMO: mismo chip que en la lista de configuracion.
export function EtiquetaPromo() {
  return (
    <span
      style={{
        display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: colors.primaryDeep, backgroundColor: withAlpha(colors.primary, '15'),
        borderRadius: 6, padding: '2px 6px',
      }}
    >
      PROMO
    </span>
  );
}

// Modo de la promo como pastilla chica con icono (secuencia = flecha hacia
// abajo; a la vez = dos barras paralelas). El texto es el vocabulario de la app.
export function PastillaModo({ paralelo }: { paralelo: boolean }) {
  const t = useTranslations('reservaOnline.servicios');
  return (
    <span
      style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: colors.sub,
        background: colors.surface, borderRadius: 999, padding: '3px 9px',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paralelo ? (
          <>
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="20" y2="16" />
          </>
        ) : (
          <>
            <line x1="12" y1="4" x2="12" y2="20" />
            <polyline points="6 14 12 20 18 14" />
          </>
        )}
      </svg>
      {t(paralelo ? 'modoParalelo' : 'modoSecuencia')}
    </span>
  );
}

// Los pasos de una promo: en secuencia van numerados y unidos por una linea; a
// la vez, bajo una barra unica. Con `detallado` cada paso suma su duracion (a
// la derecha) y la profesional con su foto (si no, la inicial); sin el, queda
// el "Con Ana" de la tarjeta de servicios.
export function PasosPromo({
  componentes,
  paralelo,
  detallado = false,
}: {
  componentes: ComponentePromo[];
  paralelo: boolean;
  detallado?: boolean;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <ol
      style={{
        position: 'relative', listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10,
        ...(paralelo ? { borderLeft: `2px solid ${colors.primarySolid}`, paddingLeft: 12 } : {}),
      }}
    >
      {!paralelo && componentes.length > 1 && (
        <div aria-hidden="true" style={{ position: 'absolute', left: 10, top: 12, bottom: 12, width: 2, background: colors.border }} />
      )}
      {componentes.map((c, i) => (
        <li key={c.orden} data-testid="promo-componente" style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {!paralelo && (
            <span
              aria-hidden="true"
              style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: colors.primarySolid, color: colors.primaryFg, fontSize: 12, fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, color: colors.textStrong, overflowWrap: 'anywhere', minWidth: 0 }}>
                {c.servicioNombre}
              </span>
              {detallado && c.duracionMinutos !== undefined && (
                <span style={{ fontSize: 13, color: colors.sub, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatearDuracion(c.duracionMinutos)}
                </span>
              )}
            </div>
            {detallado ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                <Avatar nombre={c.profesionalNombre} size={24} fotoUrl={c.profesionalAvatarUrl} />
                <span style={{ fontSize: 12.5, color: colors.sub, overflowWrap: 'anywhere', minWidth: 0 }}>
                  {t('resumen.conPersona', { profesional: c.profesionalNombre })}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 1, overflowWrap: 'anywhere' }}>
                {t('servicios.conProfesional', { profesional: c.profesionalNombre })}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
