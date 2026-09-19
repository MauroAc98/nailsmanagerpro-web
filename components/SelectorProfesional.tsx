'use client';

import type { CSSProperties } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';

export interface ProfesionalOption {
  id:       number;
  nombre:   string;
  apellido?: string | null;
  color?:   string | null;
  // Avatar real, opcional — cuando esta presente se muestra en vez de las
  // iniciales (usado por la reserva online, HorarioScreen, que pasa
  // salon.profesionales tal cual). Callers que no lo pasan (agenda,
  // historia, historia-precios) no cambian: sin esta prop nada se pinta
  // distinto.
  avatarUrl?: string | null;
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
  // Opcional: label de un pill inicial "todas/cualquiera" (con ícono de grupo)
  // que queda seleccionado cuando selectedId es null y al tocarlo llama
  // onSelect(null). Sin esta prop no se renderiza nada extra: los callers que
  // no la usan (historia, historia-precios) no cambian.
  todasLabel?: string;
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
  selectedFg = '#FFF', unselectedBorderColor = colors.divider, pillFontWeight, todasLabel,
}: Props) {
  const todasSel = selectedId === null;
  return (
    <div style={{ width: '100%', marginBottom: 14 }}>
      <p style={labelStyle ?? { margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: colors.subtext }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {todasLabel !== undefined && (
          <button
            type="button"
            aria-pressed={todasSel}
            onClick={() => onSelect(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 13, fontWeight: pillFontWeight, cursor: 'pointer',
              border: `1px solid ${todasSel ? colors.primarySolid : unselectedBorderColor}`,
              backgroundColor: todasSel ? colors.primarySolid : colors.surface,
              color: todasSel ? selectedFg : colors.text,
            }}
          >
            {/* Ícono de grupo: distingue la opción agregadora de las profesionales puntuales. */}
            <span style={{
              width: 20, height: 20, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: todasSel ? withAlpha(selectedFg, '3D') : withAlpha(colors.primary, '26'),
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke={todasSel ? selectedFg : colors.primaryDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            {todasLabel}
          </button>
        )}
        {profesionales.map(p => {
          const selected = selectedId === p.id;
          const color    = p.color || colors.primary;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected && toggleable ? null : p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 13, fontWeight: pillFontWeight, cursor: 'pointer',
                border: `1px solid ${selected ? color : unselectedBorderColor}`,
                backgroundColor: selected ? color : colors.surface,
                color: selected ? selectedFg : colors.text,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800,
                backgroundColor: selected ? withAlpha(selectedFg, '3D') : withAlpha(color, '26'),
                color: selected ? selectedFg : color,
              }}>
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  inicialesProfesional(p.nombre, p.apellido)
                )}
              </span>
              {p.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
