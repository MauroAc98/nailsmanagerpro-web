'use client';

import type { CSSProperties } from 'react';
import { agendaColors } from '@/theme/agendaColors';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

// Barra gris que late suave (.rz-skeleton, sin animación con reduce-motion).
// Es decorativa: quien la usa avisa el "cargando" para lectores de pantalla.
export function Skeleton({ width = '100%', height = 12, radius = 6, style }: Props) {
  return (
    <div
      aria-hidden="true"
      className="rz-skeleton"
      style={{ width, height, borderRadius: radius, backgroundColor: agendaColors.surfaceSubtle, flexShrink: 0, ...style }}
    />
  );
}
