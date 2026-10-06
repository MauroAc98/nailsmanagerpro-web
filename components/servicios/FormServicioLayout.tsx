'use client';

import React from 'react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { NAV_CLEARANCE } from '@/constants/layout';
import PillToggle from '@/components/PillToggle';

// Piezas compartidas por los formularios de crear/editar servicio (nuevo/page y
// [id]/page). Mismo lenguaje visual que el resto de la app: card estándar
// (borde, sombra, radio 14), serif solo en títulos, botón principal grande.

// Agrupa campos relacionados en una card estándar.
export function FormSeccion({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14,
      boxShadow: shadows.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {children}
    </section>
  );
}

// Fila "Es promoción": vive dentro de la card de datos, justo arriba de la
// sección que cambia al activarla (componentes de la promo).
export function FilaPromo({ titulo, hint, value, onChange }: {
  titulo: string; hint: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16,
      borderTop: `1px solid ${colors.hairline}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.text }}>{titulo}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>{hint}</p>
      </div>
      <PillToggle value={value} onChange={onChange} />
    </div>
  );
}

// Alto de la barra de guardar (12 + botón 52 + 12) y espacio que el formulario
// debe dejar debajo del último bloque para que la barra no lo tape.
const BARRA_ALTO = 76;
export const FORM_PADDING_BOTTOM = BARRA_ALTO + 24;

// Botón principal siempre a mano aunque el formulario sea largo. `fixed` (no
// `sticky`): el layout envuelve el contenido en un contenedor con overflow:auto
// y ahí sticky no se pega al borde de la pantalla. Se apoya sobre el bottom nav
// con la misma técnica y constantes que los FAB de las listas, que ya andan en
// Safari y en Chromium (nav-clearance + safe-area del home indicator).
export function BarraGuardar({ onClick, disabled, label }: {
  onClick: () => void; disabled: boolean; label: string;
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom))`,
      zIndex: 45, boxSizing: 'border-box', height: BARRA_ALTO, padding: '12px 20px',
      backgroundColor: colors.background, borderTop: `1px solid ${colors.hairline}`,
    }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          backgroundColor: disabled ? colors.primaryDisabled : colors.primarySolid,
          color: '#fff', fontSize: 16, fontWeight: 600,
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  );
}
