'use client';

import { ChevronDown } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';

// Turno ya cargado, plegado a una línea de resumen dentro de "Nuevo turno" con
// varios turnos. Tocarlo lo reabre para editar.
export function ResumenTurnoPlegado({
  numero, titulo, detalle, ariaLabel, onClick,
}: {
  numero:    number;
  titulo:    string;   // "lun 12 oct · 3:30 p. m."
  detalle:   string;   // servicios (+ profesional)
  ariaLabel: string;
  onClick:   () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16,
        boxShadow: shadows.card, padding: '12px 14px', marginBottom: 12,
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 14, flexShrink: 0,
        backgroundColor: colors.primarySoft, color: colors.primaryDeep,
        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {numero}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: agendaFontSerif, fontSize: 16, color: colors.textStrong }}>
          {titulo}
        </span>
        <span style={{
          display: 'block', marginTop: 2, fontSize: 12, color: colors.subtext,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {detalle}
        </span>
      </span>
      <ChevronDown size={16} strokeWidth={2} color={colors.muted} style={{ flexShrink: 0 }} />
    </button>
  );
}
