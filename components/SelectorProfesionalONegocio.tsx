'use client';

import { agendaColors as colors } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import type { Profesional } from '@/services/profesionalService';

interface Props {
  profesionales: Profesional[];
  /** id de la profesional elegida, o null = "Del negocio". */
  value: number | null;
  onChange: (id: number | null) => void;
  labelNegocio: string;
}

function chipStyle(selected: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%',
    borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 14, cursor: 'pointer',
    border: `1px solid ${selected ? color : colors.divider}`,
    backgroundColor: selected ? color : colors.surface,
    color: selected ? '#FFF' : colors.text,
  };
}

const badgeBase: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 9, fontWeight: 800,
};

const nombreStyle: React.CSSProperties = {
  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

// Siempre hay exactamente una opción elegida: tocar la ya elegida no hace nada.
export default function SelectorProfesionalONegocio({ profesionales, value, onChange, labelNegocio }: Props) {
  const negocioSel = value === null;
  const colorNegocio = colors.primary;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button
        type="button"
        aria-pressed={negocioSel}
        onClick={() => { if (!negocioSel) onChange(null); }}
        style={chipStyle(negocioSel, colorNegocio)}
      >
        <span style={{
          ...badgeBase,
          backgroundColor: negocioSel ? withAlpha('#fff', '3D') : withAlpha(colorNegocio, '26'),
          color: negocioSel ? '#fff' : colorNegocio,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l1.5-5h15L21 9" />
            <path d="M3 9h18v0a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
            <path d="M5 12v8h14v-8" />
          </svg>
        </span>
        <span style={nombreStyle}>{labelNegocio}</span>
      </button>
      {profesionales.map(p => {
        const selected = value === p.id;
        const color = p.color || colors.primary;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected}
            onClick={() => { if (!selected) onChange(p.id); }}
            style={chipStyle(selected, color)}
          >
            <span style={{
              ...badgeBase,
              backgroundColor: selected ? withAlpha('#fff', '3D') : withAlpha(color, '26'),
              color: selected ? '#fff' : color,
            }}>
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                inicialesProfesional(p.nombre, p.apellido)
              )}
            </span>
            <span style={nombreStyle}>{p.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
