import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// Estilo polaroid/scrapbook (degradé/gap descartados antes, ver historial
// git). Las 4 quedaban en 2 filas limpias (arriba/abajo) con un hueco vacío
// de fondo en el medio de ~270px — más de un tercio del canvas — que se
// reportó como "muy separado". Reemplazado por 2 COLUMNAS de fotos
// verticales (apaisadas al revés, 200x300) escalonadas entre sí en vez de
// alineadas en 2 filas: cada columna cubre casi toda la altura del canvas
// con un salto chico entre su foto de arriba y la de abajo, y esos 2 saltos
// quedan a distinta altura entre columnas — el hueco "vacío de las 2
// columnas a la vez" queda angosto (~90px) en vez de un bloque entero.
// Mismo criterio de sangrado generoso en los 2 bordes que le toca cubrir a
// cada polaroid (ver comentario histórico: un rectángulo rotado no llena
// su caja delimitadora cerca de una esquina recta del canvas).
interface PolaroidPos { top: number; left: number; rotate: number; }
const POLAROIDS: PolaroidPos[] = [
  { top: -30, left: -55, rotate: -6 }, // columna izq, arriba
  { top: -10, left: 220, rotate: 8 },  // columna der, arriba
  { top: 415, left: -50, rotate: 7 },  // columna izq, abajo
  { top: 420, left: 215, rotate: -8 }, // columna der, abajo
];
const PHOTO_W = 200;
const PHOTO_H = 300;

// LayoutGrid4 — 4 background photos in a 2x2 grid. minFotos: 4 (see
// catalogo.ts) — the most demanding layout, locked until 4 photos are
// uploaded (spec: price-story-photos, "4-photo grid locked with only 2
// photos" scenario).
export function LayoutGrid4({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#efe7e1' }}>
      {POLAROIDS.map((pos, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute', top: pos.top, left: pos.left,
            transform: `rotate(${pos.rotate}deg)`,
            background: '#ffffff', padding: '8px 8px 26px 8px',
            boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
          }}
        >
          <img
            src={fotos[idx]}
            alt=""
            style={{ display: 'block', width: PHOTO_W, height: PHOTO_H, objectFit: 'cover' }}
          />
        </div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
