'use client';

import type { CSSProperties } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';

export interface ProfesionalOption {
  id:     number;
  nombre: string;
  color?: string | null;
}

interface Props {
  // Caption arriba de la fila de pills — cada pantalla trae su propio texto
  // ya traducido ("Mostrar precios de:", "Mostrar agenda de:", etc.), el
  // componente no decide el copy.
  label:         string;
  // Override total del estilo del caption — default es el caption plano de
  // historia-precios (11px/600). agenda/historia usa un eyebrow mayúscula +
  // tracking en vez de esto; en lugar de codificar variantes con nombre, el
  // caller pasa el style object completo que ya tenía.
  labelStyle?: CSSProperties;
  profesionales: ProfesionalOption[];
  // Resuelto por el caller, no acá — el default correcto (jefa, ninguno
  // seleccionado, o "Todas") varía según qué hace la pantalla, ver
  // convención documentada en memoria de sesión.
  selectedId:    number | null;
  onSelect:      (id: number | null) => void;
  // true (default): tocar el pill ya seleccionado lo deselecciona (vuelve a
  // null). false: pantallas que fuerzan una elección explícita (ej.
  // agenda/nuevo) donde deseleccionar no tiene sentido.
  toggleable?: boolean;
  // Color de texto/punto sobre el pill seleccionado (fondo = color propio
  // del profesional). Default '#FFF' (historia-precios). agenda/historia
  // pasa colors.primaryFg — mismo valor renderizado hoy, pero es el token
  // correcto para texto-sobre-primary en vez de un blanco hardcodeado.
  selectedFg?: string;
  // Color de borde del pill SIN seleccionar. Default colors.divider
  // (historia-precios, hairline sutil). agenda/historia pasa colors.border
  // (más marcado) — mismo criterio: no forzar un valor sobre el otro.
  unselectedBorderColor?: string;
  // Peso de fuente del label del pill. Default sin setear (historia-precios
  // no lo especifica). agenda/historia pasa 600.
  pillFontWeight?: number;
}

// SelectorProfesional — pill picker compartido para elegir un profesional
// activo entre varios, extraído de historia-precios/page.tsx (diseño base
// ya validado: punto de color + nombre, relleno del color propio cuando
// está seleccionado). El caller sigue resolviendo visibilidad (¿hay más de
// un profesional activo?) y el id seleccionado por default — este
// componente solo pinta la fila y notifica el click. Los props de estilo
// opcionales existen porque, al migrar la 2da pantalla (agenda/historia),
// aparecieron diferencias reales de token (no arbitrarias) frente al
// diseño de referencia — se exponen en vez de forzar un único look.
export default function SelectorProfesional({
  label, labelStyle, profesionales, selectedId, onSelect, toggleable = true,
  selectedFg = '#FFF', unselectedBorderColor = colors.divider, pillFontWeight,
}: Props) {
  return (
    <div style={{ width: '100%', marginBottom: 14 }}>
      <p style={labelStyle ?? { margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: colors.subtext }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {profesionales.map(p => {
          const selected = selectedId === p.id;
          const color    = p.color || colors.primary;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(selected && toggleable ? null : p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: pillFontWeight, cursor: 'pointer',
                border: `1px solid ${selected ? color : unselectedBorderColor}`,
                backgroundColor: selected ? color : colors.surface,
                color: selected ? selectedFg : colors.text,
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                backgroundColor: selected ? selectedFg : color,
              }} />
              {p.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
