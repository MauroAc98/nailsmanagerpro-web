import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// Vuelto a la versión original a pedido explícito, después de varios
// intentos de tratar la unión entre las 2 fotos (degradé oscuro, gap con
// esquinas redondeadas, polaroid superpuesta, línea de color, insignia
// circular — ninguno convenció). Plano y sin adornos a propósito.
export function LayoutSplit2({ fotos, overlayOpacity, children }: Props) {
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
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}
