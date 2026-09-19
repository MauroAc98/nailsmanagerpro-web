'use client';

import type { CSSProperties } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { IcoImagen } from './iconos';

// Degrades de las baldosas de ejemplo del tablero (no son del tema).
const GRADIENTES = [
  ['#d8e2d6', '#9fb99e'],
  ['#e6c9cf', '#c99aa6'],
  ['#eadcc0', '#cfae7a'],
  ['#d2d8e8', '#98a6cc'],
];

const PREFIJO_PLACEHOLDER = 'placeholder:';

// Foto de un servicio: imagen real (url o data URL) o, para las fotos de
// ejemplo del mock (`placeholder:N`), una baldosa de gradiente sin red.
// Rellena a su contenedor; el tamano y el radio los pone quien la usa.
export function FotoTile({
  src,
  estilo,
  iconoTam = 18,
}: {
  src: string;
  estilo?: CSSProperties;
  iconoTam?: number;
}) {
  const base: CSSProperties = { width: '100%', height: '100%', ...estilo };
  if (src.startsWith(PREFIJO_PLACEHOLDER)) {
    const n = Number(src.slice(PREFIJO_PLACEHOLDER.length)) || 0;
    const [a, b] = GRADIENTES[n % GRADIENTES.length];
    return (
      <div
        data-placeholder={n}
        style={{
          ...base,
          background: `linear-gradient(135deg, ${a}, ${b})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IcoImagen color={colors.primaryFg} size={iconoTam} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ ...base, objectFit: 'cover', display: 'block' }} />;
}
