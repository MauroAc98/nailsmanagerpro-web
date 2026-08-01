import { ReactNode } from 'react';

interface Props {
  fotos:    string[];
  children: ReactNode;
}

// LayoutSingle — 1 background photo, full-bleed. minFotos: 1 (see
// catalogo.ts) — always the fallback layout, never locked once at least one
// photo is uploaded.
export function LayoutSingle({ fotos, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src={fotos[0]}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)' }} />
      {children}
    </div>
  );
}
