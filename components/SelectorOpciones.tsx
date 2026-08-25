'use client';

import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';

export interface Opcion<T extends string> {
  value:     T;
  title:     string;
  // Apariencia muestra una línea de subtítulo por opción, Idioma no —
  // opcional en vez de forzar un string vacío en el caller.
  subtitle?: string;
}

interface Props<T extends string> {
  opciones: Opcion<T>[];
  selected: T;
  onSelect: (value: T) => void;
  // Value que se está guardando ahora mismo (solo Idioma: persiste en
  // backend, ver configuracion/idioma/page.tsx). null (default) = todas
  // las opciones siempre clickeables, mismo comportamiento que Apariencia
  // (preferencia 100% local, nunca deshabilitada).
  loadingValue?: T | null;
}

// SelectorOpciones — lista de opciones tipo radio-card (título + subtítulo
// opcional + check al seleccionar), extraído de
// configuracion/apariencia/page.tsx e idioma/page.tsx: ambas pantallas
// tenían este layout calcado 1:1 (idioma/page.tsx ya lo documentaba en un
// comentario propio antes de esta extracción). Mismo criterio que
// components/SelectorProfesional.tsx: props explícitas para lo que varía
// de verdad entre las dos pantallas, sin flexibilidad de más.
export default function SelectorOpciones<T extends string>({ opciones, selected, onSelect, loadingValue = null }: Props<T>) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {opciones.map(op => {
        const esSeleccionada = selected === op.value;
        const deshabilitado  = loadingValue !== null;
        return (
          <button
            key={op.value}
            onClick={() => onSelect(op.value)}
            disabled={deshabilitado}
            style={{
              display: 'flex', alignItems: 'center', gap: 15,
              backgroundColor: esSeleccionada ? withAlpha(colors.primary, '12') : colors.surface,
              border: `1px solid ${esSeleccionada ? colors.primaryDeep : colors.border}`,
              boxShadow: shadows.card, borderRadius: 14,
              padding: '14px 16px', cursor: deshabilitado ? 'not-allowed' : 'pointer', textAlign: 'left',
              opacity: deshabilitado && loadingValue !== op.value ? 0.6 : 1,
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>{op.title}</p>
              {op.subtitle && (
                <p style={{ margin: '2px 0 0', fontSize: 13, color: colors.subtext }}>{op.subtitle}</p>
              )}
            </div>
            {esSeleccionada && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
