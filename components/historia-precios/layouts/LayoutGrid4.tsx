import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutGrid4 — 4 fotos en una grilla 2x2 pareja, full-bleed. Reusado por
// dos plantillas (Portafolio y Catálogo, ver catalogo.ts) que comparten
// esta composición y se diferencian solo por mood/anclaje de tarjeta.
// minFotos: 4, la composición más exigente en fotos del catálogo.
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
          <div key={idx} style={{ width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
            <img
              src={fotos[idx]}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
