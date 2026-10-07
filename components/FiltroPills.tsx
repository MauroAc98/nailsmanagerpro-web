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
  ariaLabel?: string;
}

// Fila de pastillas excluyentes para filtrar una lista ("Todos / Activos /
// Inactivos"). Estándar de filtros de estado de la app: el espaciado alrededor
// lo pone quien lo usa. Para elegir entre opciones dentro de un formulario,
// usar SegmentedControl.
export function FiltroPills<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 8 }}>
      {options.map(o => {
        const activo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px', minHeight: 32, borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
              backgroundColor: activo ? colors.primarySolid : colors.surface,
              color: activo ? '#FFF' : colors.text,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
