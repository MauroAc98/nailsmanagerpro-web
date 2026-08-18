import { ReactNode } from 'react';
import { nombreMes } from '@/lib/dateFormat';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutFullBleed — foto única confinada a la franja superior del canvas
// (PHOTO_HEIGHT_PCT — debe mantenerse igual al offset 'top' que usa
// TarjetaPrecios en su variante 'panel', son las dos mitades de un mismo
// split). Sin scrim plano sobre toda la foto (a diferencia del resto del
// catálogo, que sí usa `overlayOpacity` para eso) — el brief pide una foto
// "limpia", así que acá ese parámetro no se destructura (no tiene uso) y en
// su lugar hay un gradient acotado a la franja inferior de la foto, solo
// para que el caption de metadata sea legible. minFotos: 1 (ver catalogo.ts).
const PHOTO_HEIGHT_PCT = 56;

export function LayoutFullBleed({ fotos, children }: Props) {
  const ahora   = new Date();
  const periodo = `${nombreMes(ahora, 'long', 'mayusculas')} ${ahora.getFullYear()}`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${PHOTO_HEIGHT_PCT}%`, overflow: 'hidden' }}>
        <img
          src={fotos[0]}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)',
          }}
        />
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#faf7f2' }}>
            {periodo}
          </span>
          <div style={{ marginTop: 6, height: 1, width: 32, background: '#a8623f' }} />
        </div>
      </div>
      {children}
    </div>
  );
}
