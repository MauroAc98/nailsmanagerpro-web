import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutCollage — hero + 2 apiladas: fotos[0] grande a la izquierda (ocupa
// toda la altura del bloque), fotos[1]/fotos[2] apiladas a la derecha en 2
// celdas iguales. Reemplaza la versión anterior (2 fotos chicas arriba + 1
// franja panorámica abajo) — esa forzaba 3 relaciones de aspecto muy
// distintas vía object-fit:cover sobre las MISMAS fotos subidas (2 casi-
// cuadradas + 1 panorámica angosta) y terminaba leyendo "collage forzado"
// en vez de "editorial" (feedback de usuario, 2026-08-19). Esta versión solo
// tiene 2 proporciones (la grande vertical, y las 2 chicas iguales entre
// sí), jerarquía clara tipo tapa de revista — la variedad visual sale de
// CUÁL foto es la protagonista (fotos[0], por orden de subida en
// GestorFotos), no de forzar recortes dispares. Apoyada sobre un fondo
// oscuro sólido (no full-bleed como LayoutSingle/Split2/Grid4 — el bloque de
// fotos ocupa solo una porción del canvas, mismo criterio que la versión
// anterior). minFotos: 3 (ver catalogo.ts).
const BLOCK_H = 350;
const LEFT_W  = 260;
const GAP     = 2;

export function LayoutCollage({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#2b2226' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: BLOCK_H, overflow: 'hidden',
          display: 'grid', gridTemplateColumns: `${LEFT_W}px 1fr`, gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: GAP,
        }}
      >
        {/* minmax(0, 1fr) en las filas (no "1fr" a secas) + minHeight:0 en las
            imágenes: fotos[0] abarca las 2 filas (gridRow: 1/3) con
            height:100%, y "1fr" solo es un atajo de minmax(auto, 1fr) — ese
            mínimo "auto" toma el min-content de fotos[0] (su alto intrínseco
            a 260px de ancho, retratos altos dan un min-content grande) y
            empuja las filas a crecer MÁS ALLÁ de BLOCK_H. El overlay oscuro
            de abajo solo cubre BLOCK_H a propósito, así que ese desborde
            quedaba sin oscurecer — se veía como una franja más clara "por el
            medio" de la imagen (bug real, reportado por el usuario). */}
        <img
          src={fotos[0]}
          alt=""
          style={{ gridRow: '1 / 3', width: '100%', height: '100%', minHeight: 0, objectFit: 'cover', display: 'block' }}
        />
        <img
          src={fotos[1]}
          alt=""
          style={{ width: '100%', height: '100%', minHeight: 0, objectFit: 'cover', display: 'block' }}
        />
        <img
          src={fotos[2]}
          alt=""
          style={{ width: '100%', height: '100%', minHeight: 0, objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BLOCK_H, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
