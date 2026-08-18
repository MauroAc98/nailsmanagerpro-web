import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutPolaroid — 1 foto de fondo full-bleed + 1 foto de acento en marco
// polaroid rotado, apoyada arriba a la derecha, sensación "boutique" (nota
// del mock v0). minFotos: 2 (ver catalogo.ts) — fotos[0] es el fondo,
// fotos[1] es el acento. Tamaño/posición del acento escalados desde el
// mock (h-28/w-24 sobre un preview de 276px) al BASE_WIDTH real (420, ver
// HistoriaPreciosCanvas) — factor ~1.52.
const ACCENT_W = 148;
const ACCENT_H = 188;

export function LayoutPolaroid({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src={fotos[0]}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      <div
        style={{
          position: 'absolute', top: 48, right: -14,
          transform: 'rotate(6deg)',
          background: '#ffffff', padding: '10px 10px 30px 10px',
          boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
        }}
      >
        <img
          src={fotos[1]}
          alt=""
          style={{ display: 'block', width: ACCENT_W, height: ACCENT_H, objectFit: 'cover' }}
        />
      </div>
      {children}
    </div>
  );
}
