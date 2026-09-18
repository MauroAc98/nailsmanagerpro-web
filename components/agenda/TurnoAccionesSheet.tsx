'use client';

import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

export interface AccionTurno {
  key:      string;
  label:    string;
  icon:     'finalizar' | 'editar' | 'cancelar';
  onSelect: () => void;
  danger?:  boolean;
}

interface Props {
  titulo:    string;
  acciones:  AccionTurno[];
  cerrarLabel: string;
  onClose:   () => void;
}

const ICONOS = { finalizar: Check, editar: Pencil, cancelar: X };

// Menú de acciones de un turno ("⋯"): sheet inferior con targets de 52px.
// Se monta por portal en <body> — la card tiene overflow:hidden y un menú
// posicionado adentro quedaría recortado. Ojo: los eventos de React
// burbujean por el árbol de componentes aunque el DOM esté en otro lado, así
// que se corta la propagación de touch/click para que el gesto de swipe de
// la card padre no se dispare por tocar el menú (mismo gotcha del modal del
// mapa dentro de BottomSheet).
export function TurnoAccionesSheet({ titulo, acciones, cerrarLabel, onClose }: Props) {
  const frenar = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      onClick={e => { e.stopPropagation(); onClose(); }}
      onTouchStart={frenar} onTouchMove={frenar} onTouchEnd={frenar}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-label={titulo}
        onClick={frenar}
        style={{
          width: '100%', maxWidth: 480, boxSizing: 'border-box', backgroundColor: colors.surface,
          borderRadius: '24px 24px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, margin: '0 auto 12px' }} />
        <p style={{ margin: '0 0 8px 4px', fontFamily: agendaFontSerif, fontSize: 19, color: colors.textStrong }}>{titulo}</p>

        {acciones.map(a => {
          const Icono = ICONOS[a.icon];
          const color = a.danger ? colors.danger : colors.text;
          return (
            <button
              key={a.key}
              onClick={() => { a.onSelect(); onClose(); }}
              style={{
                width: '100%', height: 52, display: 'flex', alignItems: 'center', gap: 12,
                padding: '0 14px', marginBottom: 6, border: 'none', borderRadius: 14, textAlign: 'left',
                cursor: 'pointer', fontSize: 15, fontWeight: a.danger ? 700 : 600, color,
                backgroundColor: a.danger ? colors.dangerBg : colors.surfaceSubtle,
              }}
            >
              <Icono size={18} color={a.danger ? colors.danger : colors.primaryDeep} strokeWidth={2.2} />
              {a.label}
            </button>
          );
        })}

        <button
          onClick={onClose}
          style={{
            width: '100%', height: 46, marginTop: 4, border: 'none', background: 'none',
            fontSize: 14, fontWeight: 600, color: colors.subtext, cursor: 'pointer',
          }}
        >
          {cerrarLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
