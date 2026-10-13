import type { ReactNode } from 'react';

const anillo = (inset: number, ancho: number, color: string) => (
  <span
    aria-hidden="true"
    data-anillo=""
    style={{
      position: 'absolute', top: -inset, right: -inset, bottom: -inset, left: -inset,
      borderRadius: '50%', borderStyle: 'solid', borderWidth: ancho, borderColor: color, boxSizing: 'border-box',
    }}
  />
);

// Círculo de la insignia de las historias (foto del negocio o chip) con su anillo:
// un aro blanco de 1,5px y un halo translúcido de 3px por fuera.
//
// El anillo se arma con DOS BORDES concéntricos, no con `box-shadow`: las historias
// se generan con html-to-image, que rasteriza el HTML como SVG foreignObject, y
// WebKit pinta mal el halo de un box-shadow con spread sobre un elemento redondeado
// (lo dibuja relleno, como una media luna que tapa parte de la foto — real en prod
// 2026-10-13). Tampoco un `filter` en vivo: dejaba la historia entera negra en
// Safari (2026-10-01). Los anillos son hijos absolutos; el contenido va encima.
export function AnilloInsignia({
  tamano,
  testId,
  children,
}: {
  tamano: number;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-testid={testId}
      style={{ position: 'relative', flexShrink: 0, width: tamano, height: tamano, display: 'flex' }}
    >
      {anillo(4.5, 3, 'rgba(255,255,255,0.22)')}
      {anillo(1.5, 1.5, 'rgba(255,255,255,0.85)')}
      {children}
    </span>
  );
}
