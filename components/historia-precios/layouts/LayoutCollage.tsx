import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutCollage — 3 fotos en un bloque superior (2 tiles arriba + 1 franja
// ancha abajo), apoyadas sobre un fondo oscuro sólido (no full-bleed como
// LayoutSingle/Split2/Grid4 — el bloque de fotos ocupa solo la mitad
// superior del canvas, mismo patrón que el mock v0). minFotos: 3 (ver
// catalogo.ts): fotos[0] arriba-izq, fotos[1] arriba-der, fotos[2] franja.
// Fondo #2b2226 = --ag-strong (.agenda-light), sólido detrás del bloque de
// fotos — no ligado a ningún mood de tarjeta en particular (ver estilos.ts
// para el mood/tokens que usa cada plantilla que reusa este layout).
const TOP_H    = 220;
const BAND_H   = 130;

export function LayoutCollage({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#2b2226' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H, display: 'flex', gap: 2 }}>
        <img
          src={fotos[0]}
          alt=""
          style={{ flex: 1, height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <img
          src={fotos[1]}
          alt=""
          style={{ flex: 1, height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <img
        src={fotos[2]}
        alt=""
        style={{ position: 'absolute', top: TOP_H + 2, left: 0, right: 0, height: BAND_H, width: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H + BAND_H + 2, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
