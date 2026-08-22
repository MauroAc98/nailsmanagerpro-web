'use client';

import React from 'react';
import { colors } from '@/theme/colors';

interface Props {
  titulo: string;
  icono: React.ReactNode;
  // Opcional — algunas secciones (ej. Suscripción) son solo informativas,
  // sin acción de edición del lado del usuario.
  onEditar?: () => void;
  children: React.ReactNode;
}

export function CardSeccion({ titulo, icono, onEditar, children }: Props) {
  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}` }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icono}
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{titulo}</span>
        </div>
        {onEditar && (
          <button
            onClick={onEditar}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: colors.primaryDeep,
            }}
          >
            Editar
          </button>
        )}
      </div>
      <div style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}
