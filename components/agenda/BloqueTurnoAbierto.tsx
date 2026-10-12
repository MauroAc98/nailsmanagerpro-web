'use client';

import React from 'react';
import { Calendar, ChevronRight, X } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

// Marco del turno que se está editando en "Nuevo turno". Con un solo turno
// (`lote` falso) no pinta nada propio: deja pasar los campos de siempre tal cual.
// Con varios, los encuadra en una tarjeta con encabezado "Turno N", botón para
// quitarlo y la fila "Día" que abre la hoja de fecha.
export function BloqueTurnoAbierto({
  lote, numero, titulo, quitarLabel, onQuitar, diaLabel, diaTexto, onElegirDia, children,
}: {
  lote:        boolean;
  numero:      number;
  titulo:      string;   // "Turno 2"
  quitarLabel: string;   // "Quitar turno 2"
  onQuitar:    () => void;
  diaLabel:    string;   // "DÍA"
  diaTexto:    string;   // "martes 14 de octubre"
  onElegirDia: () => void;
  children:    React.ReactNode;
}) {
  if (!lote) return <>{children}</>;

  return (
    <div style={{
      backgroundColor: colors.surface, border: `1.5px solid ${colors.primarySolid}`, borderRadius: 16,
      boxShadow: shadows.card, padding: 14, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 14, flexShrink: 0,
          backgroundColor: colors.primarySolid, color: colors.primaryFg,
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {numero}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: agendaFontSerif, fontSize: 17, color: colors.textStrong }}>
          {titulo}
        </span>
        <button
          type="button"
          aria-label={quitarLabel}
          onClick={onQuitar}
          style={{
            width: 32, height: 32, borderRadius: 16, flexShrink: 0, padding: 0, border: 'none', cursor: 'pointer',
            backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} strokeWidth={2} color={colors.muted} />
        </button>
      </div>

      <p style={sectionLabelStyle}>{diaLabel}</p>
      <button
        type="button"
        aria-label={`${diaLabel}: ${diaTexto}`}
        onClick={onElegirDia}
        style={{
          width: '100%', boxSizing: 'border-box', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 12,
          padding: '12px 14px', fontSize: 15, color: colors.text,
        }}
      >
        <Calendar size={16} strokeWidth={2} color={colors.muted} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {diaTexto}
        </span>
        <ChevronRight size={16} strokeWidth={2} color={colors.muted} style={{ flexShrink: 0 }} />
      </button>

      {children}
    </div>
  );
}
