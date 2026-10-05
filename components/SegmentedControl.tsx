'use client';

import { agendaColors as colors } from '@/theme/agendaColors';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

// Selector de dos o más opciones excluyentes (botones con aria-pressed).
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 6,
        backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 4,
      }}
    >
      {options.map(o => {
        const activo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.value)}
            style={{
              minHeight: 44, border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              backgroundColor: activo ? colors.primarySolid : 'transparent',
              color: activo ? '#fff' : colors.subtext,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
