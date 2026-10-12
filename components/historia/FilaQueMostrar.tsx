'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  // Visual de 32px a la izquierda (avatar, foto o ícono).
  leading: ReactNode;
  titulo: string;
  valor: string;
  // true = hay un filtro aplicado: el valor va en el color primario.
  activo: boolean;
  onClick: () => void;
}

// Fila de la tarjeta "Qué mostrar": visual · título · valor · chevron. Toda la
// fila es un botón (alto 56 >= 44px táctil).
export function FilaQueMostrar({ leading, titulo, valor, activo, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${titulo}: ${valor}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 56, padding: '0 14px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {leading}
      </span>
      <span style={{ flexShrink: 0, fontSize: 15, color: colors.textStrong }}>{titulo}</span>
      <span style={{
        flex: 1, minWidth: 0, textAlign: 'right', fontSize: 14, fontWeight: 600,
        color: activo ? colors.primary : colors.muted,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {valor}
      </span>
      <ChevronRight size={16} strokeWidth={2} color={colors.muted} style={{ flexShrink: 0 }} />
    </button>
  );
}
