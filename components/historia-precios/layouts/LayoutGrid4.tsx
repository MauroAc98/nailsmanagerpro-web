import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutGrid4 — Mosaico: 4 fotos en una grilla 2x2 pareja, full-bleed.
// minFotos: 4 (ver catalogo.ts), la plantilla más exigente en fotos.
// Reemplaza el tratamiento scattered-polaroid anterior de este archivo (ver
// historial git) — la migración al catálogo plano de plantillas (ver plan de
// migración) movió ese look de "acento rotado" a un template dedicado
// (`LayoutFullBleed`'s predecesor, ya reemplazado), así que este quedó como
// grilla pareja sin rotación.
const GAP = 3;

export function LayoutGrid4({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: GAP,
        }}
      >
        {[0, 1, 2, 3].map(idx => (
          <img
            key={idx}
            src={fotos[idx]}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
