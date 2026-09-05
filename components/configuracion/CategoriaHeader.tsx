'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  categoriaId:      number | null; // null → "Sin categoría"
  nombre:           string;        // ya resuelto por el padre (t('sectionSinCategoria') para null)
  count:            number;        // activos + inactivos (spec: el conteo incluye inactivos)
  colapsada:        boolean;
  onToggleColapsar: () => void;
  // Ausente para el grupo "Sin categoría" — no hay nada que preseleccionar
  // (ver design D4/D5, contrato de quick-add).
  onQuickAdd?:      () => void;
  panelId:          string; // para aria-controls
}

// Header colapsable de una categoría en el listado de Servicios (Slice B).
// Dos <button> HERMANOS, nunca anidados — un <button> dentro de otro
// <button> es HTML inválido y algunos navegadores lo "arreglan" cerrando el
// exterior antes de tiempo, rompiendo el layout. El botón de toggle ocupa
// todo el ancho disponible (flex:1); el "+" de quick-add es un botón aparte
// al lado, no un hijo.
export default function CategoriaHeader({
  nombre, count, colapsada, onToggleColapsar, onQuickAdd, panelId,
}: Props) {
  const t = useTranslations('configuracion.ServiciosPage');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        aria-expanded={!colapsada}
        aria-controls={panelId}
        aria-label={colapsada ? t('expandCategory') : t('collapseCategory')}
        onClick={onToggleColapsar}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left',
        }}
      >
        {/* Sin ícono (feedback de usuario: las formas no van, ver
            refactor/quitar-iconos-categoria) — el propio estado
            relleno/hueco del círculo es ahora la señal de
            colapsado/expandido, además del chevron que ya rota. */}
        <div style={{
          width: 14, height: 14, flexShrink: 0, borderRadius: 7,
          backgroundColor: colapsada ? 'transparent' : colors.primaryDeep,
          border: colapsada ? `2px solid ${colors.border}` : 'none',
        }} />

        {/* minWidth:0 + ellipsis en el nombre, flexShrink:0 en el pill y el
            chevron — sin esto un nombre largo empuja los controles fuera de
            la fila (bug recurrente en filas nombre+controles de esta app). */}
        <p style={{
          flex: 1, minWidth: 0, margin: 0, fontSize: 13, fontWeight: 700,
          color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {nombre}
        </p>

        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: colors.subtext,
          backgroundColor: colors.surfaceSubtle, borderRadius: 10, padding: '2px 8px',
        }}>
          {t('categoryServiceCount', { count })}
        </span>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2"
          style={{ flexShrink: 0, transform: `rotate(${colapsada ? 0 : 90}deg)`, transition: 'transform .18s ease' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {onQuickAdd && (
        <button
          aria-label={t('addServiceToCategory')}
          onClick={onQuickAdd}
          style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: 14,
            background: 'none', border: `1px solid ${colors.border}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subtext,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
