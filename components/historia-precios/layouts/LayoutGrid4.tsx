import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

const CELDAS: Array<{ top: number | string; left: number | string }> = [
  { top: 0,     left: 0 },
  { top: 0,     left: '50%' },
  { top: '50%', left: 0 },
  { top: '50%', left: '50%' },
];

// LayoutGrid4 — 4 background photos in a 2x2 grid. minFotos: 4 (see
// catalogo.ts) — the most demanding layout, locked until 4 photos are
// uploaded (spec: price-story-photos, "4-photo grid locked with only 2
// photos" scenario).
export function LayoutGrid4({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {CELDAS.map((pos, idx) => (
        <img
          key={idx}
          src={fotos[idx]}
          alt=""
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: '50%', height: '50%', objectFit: 'cover' }}
        />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
