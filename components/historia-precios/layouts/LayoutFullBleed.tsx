import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutFullBleed — foto de fondo full-bleed nítida, sin blur (2026-08-18,
// séptima actualización: se sacó el blur por completo). La foto no es solo
// fondo decorativo — es la publicidad del trabajo, tiene que verse nítida.
// La legibilidad del texto la resuelve la tarjeta de TarjetaPrecios (más
// opaca que el resto del catálogo, ver estiloFullBleed) y el scrim de acá
// abajo, no el blur. Composición idéntica a LayoutSingle — la diferencia de
// `fullbleed` con el resto del catálogo es la tarjeta (opaca, sin sombra,
// ver TarjetaPrecios variante 'panel') y la paleta, no el tratamiento de foto.
export function LayoutFullBleed({ fotos, overlayOpacity, children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src={fotos[0]}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
