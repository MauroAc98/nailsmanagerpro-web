import { ReactNode } from 'react';

interface Props {
  fotos:    string[];
  children: ReactNode;
}

// LayoutSplit2 — 2 background photos, stacked top/bottom halves. minFotos: 2
// (see catalogo.ts). Vertical split (not side-by-side) matches the tall
// 9:16 canvas aspect ratio.
export function LayoutSplit2({ fotos, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src={fotos[0]}
        alt=""
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', width: '100%', objectFit: 'cover' }}
      />
      <img
        src={fotos[1]}
        alt=""
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', width: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)' }} />
      {children}
    </div>
  );
}
