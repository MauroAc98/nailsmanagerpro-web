import { ReactNode } from 'react';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutTipografico — sin foto de fondo. minFotos: 0 (ver catalogo.ts), la
// única plantilla del catálogo que no depende de ninguna foto subida — la
// tarjeta (estiloType, ver estilos.ts) es opaca porque no hay nada detrás
// que se filtre. `fotos`/`overlayOpacity` se reciben igual que el resto de
// los layouts por firma común (LayoutComponentProps) pero no se usan acá.
// Fondo #efe9e7 = --ag-bg (.agenda-light) — mismo fondo de página que el
// resto del rediseño agenda, para que la tarjeta opaca hueso (estiloType)
// se recorte contra un backdrop coherente en vez de un hex suelto.
export function LayoutTipografico({ children }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#efe9e7' }}>
      {children}
    </div>
  );
}
