'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

interface Props {
  nombre:           string;        // ya resuelto por el padre (t('sectionSinCategoria') para null)
  count:            number;        // activos + inactivos (spec: el conteo incluye inactivos)
  colapsada:        boolean;
  onToggleColapsar: () => void;
  panelId:          string; // para aria-controls
}

// Header colapsable de una categoría en el listado de Servicios. Un único
// <button> de ancho completo: el alta de servicios ya no vive acá (el botón
// flotante crea en la categoría abierta), así que no hay controles pegados.
// El estado abierta/cerrada lo marcan el color del título y el giro del
// chevron dentro de su círculo.
export default function CategoriaHeader({
  nombre, count, colapsada, onToggleColapsar, panelId,
}: Props) {
  const t = useTranslations('configuracion.ServiciosPage');

  return (
    <button
      aria-expanded={!colapsada}
      aria-controls={panelId}
      aria-label={colapsada ? t('expandCategory') : t('collapseCategory')}
      onClick={onToggleColapsar}
      style={{
        width: '100%', minWidth: 0, minHeight: 48, display: 'flex', alignItems: 'center', gap: 12,
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left',
      }}
    >
      {/* minWidth:0 + ellipsis en el nombre, flexShrink:0 en la cantidad y el
          círculo — sin esto un nombre largo empuja los controles fuera de la
          fila (bug recurrente en filas nombre+controles de esta app). */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          minWidth: 0, fontFamily: agendaFontSerif, fontSize: 20, lineHeight: 1.2,
          color: colapsada ? colors.subtext : colors.textStrong,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {nombre}
        </span>
        <span style={{ flexShrink: 0, fontSize: 13, color: colors.placeholder }}>
          {t('categoryServiceCount', { count })}
        </span>
      </span>

      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 16,
          backgroundColor: colapsada ? colors.surfaceSubtle : colors.primarySoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: `rotate(${colapsada ? 0 : 180}deg)`, transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  );
}
