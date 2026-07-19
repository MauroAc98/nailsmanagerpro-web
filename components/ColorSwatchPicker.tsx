'use client';

import { colors, profesionalPalette } from '@/theme/colors';

interface Props {
  value:    string;
  onChange: (color: string) => void;
}

// ─────────────────────────────────────────────
// ColorSwatchPicker — grid of preset color swatches, used to assign a
// distinguishing color to a Profesional. Deliberately not a free color
// input: a curated palette keeps every professional's color readable at the
// small sizes used in the agenda (chips, 9px name label on the turno card).
// ─────────────────────────────────────────────
export default function ColorSwatchPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {profesionalPalette.map(color => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: color, cursor: 'pointer',
              border: selected ? `3px solid ${colors.textStrong}` : '3px solid transparent',
              boxShadow: selected ? `0 0 0 2px ${colors.surface}, 0 1px 4px rgba(0,0,0,0.25)` : '0 1px 3px rgba(0,0,0,0.15)',
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}
