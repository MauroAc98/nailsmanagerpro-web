'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown } from 'lucide-react';
import { colors, profesionalPaletaGrupos } from '@/theme/colors';

interface Props {
  value:    string;
  onChange: (color: string) => void;
}

// Tilde legible sobre el color: oscura en los claros (celeste, ámbar), blanca en los oscuros.
function tildeSobre(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.65 ? '#1f2a1f' : '#ffffff';
}

// ─────────────────────────────────────────────
// ColorSwatchPicker — preset colors to tell each Profesional apart. Deliberately
// not a free color input: a curated palette keeps every color readable at the
// small sizes used in the agenda (chips, 9px name label on the turno card).
// Cerrado ocupa una sola fila (el color actual); abierto flota sobre el
// formulario, sin empujarlo hacia abajo, con los colores en dos grupos.
// ─────────────────────────────────────────────
export default function ColorSwatchPicker({ value, onChange }: Props) {
  const t = useTranslations('common.ColorSwatchPicker');
  const [abierto, setAbierto] = useState(false);

  const grupos = [
    { clave: 'suaves', titulo: t('suaves'), lista: profesionalPaletaGrupos.suaves },
    { clave: 'intensos', titulo: t('intensos'), lista: profesionalPaletaGrupos.intensos },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-label={t('ariaLabel', { color: value })}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', borderRadius: 24, cursor: 'pointer',
          border: `1px solid ${abierto ? colors.primaryDeep : colors.border}`, backgroundColor: colors.surface, color: colors.text,
        }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: value, flexShrink: 0 }} />
        <span style={{ fontSize: 14 }}>{t('cambiar')}</span>
        <ChevronDown size={16} strokeWidth={2} color={colors.muted} aria-hidden="true"
          style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div
            role="group"
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 21, boxSizing: 'border-box',
              width: 'min(100%, 340px)', padding: 14, borderRadius: 16, backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            {grupos.map(g => (
              <div key={g.clave}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>
                  {g.titulo}
                </p>
                <div role="radiogroup" aria-label={g.titulo} style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                  {g.lista.map(color => {
                    const selected = color.toLowerCase() === value.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={t('ariaLabel', { color })}
                        onClick={() => { onChange(color); setAbierto(false); }}
                        style={{
                          aspectRatio: '1', width: '100%', borderRadius: '50%', padding: 0, border: 'none', cursor: 'pointer',
                          backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: selected ? `0 0 0 2px ${colors.surface}, 0 0 0 4px ${color}` : 'none',
                        }}
                      >
                        {selected && <Check size={14} strokeWidth={3} color={tildeSobre(color)} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
