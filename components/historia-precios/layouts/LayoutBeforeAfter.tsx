'use client';

import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutBeforeAfter — 2 fotos apiladas igual que LayoutSplit2 (foto[0]
// arriba, foto[1] abajo, cada una 50% de alto). A diferencia de Split2
// (deliberadamente plano y sin adornos, ver su comentario), este layout
// existe para el flujo de antes/después aunque ya no muestra rótulos.
export function LayoutBeforeAfter({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        <img src={fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        <img src={fotos[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
