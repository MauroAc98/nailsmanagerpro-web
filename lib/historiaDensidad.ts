// Densidad de la tarjeta de la historia de precios. El canvas es fijo (9:16),
// así que lo que se adapta es el contenido: se prueba cada nivel, de más
// cómodo a más compacto, hasta el primero que entra en el alto disponible.
// La decisión (elegirDensidad) es pura; la medición real vive en
// TarjetaPrecios.

// Fuente mínima legible de una fila, en px del canvas base de 420px de ancho
// (~31px en el export de 1080px). Ningún nivel baja de acá.
export const PISO_FUENTE_FILA = 12;

export interface DensidadTokens {
  fuenteNombre:     number;
  fuentePrecio:     number;
  rowGap:           number;
  groupGap:         number;
  rowPaddingY:      number;
  cardPaddingY:     number;
  footerMarginTop:  number;
  footerPaddingTop: number;
}

// Ordenados de más cómodo (0) a más compacto. Cada valor es <= al del nivel
// anterior (lo verifica el test).
export const NIVELES_DENSIDAD: readonly DensidadTokens[] = [
  { fuenteNombre: 12.5, fuentePrecio: 13,   rowGap: 14, groupGap: 20, rowPaddingY: 10, cardPaddingY: 24, footerMarginTop: 20, footerPaddingTop: 14 },
  { fuenteNombre: 12.5, fuentePrecio: 13,   rowGap: 8,  groupGap: 12, rowPaddingY: 6,  cardPaddingY: 24, footerMarginTop: 20, footerPaddingTop: 14 },
  { fuenteNombre: 12,   fuentePrecio: 12.5, rowGap: 6,  groupGap: 10, rowPaddingY: 4,  cardPaddingY: 18, footerMarginTop: 14, footerPaddingTop: 10 },
  { fuenteNombre: 12,   fuentePrecio: 12,   rowGap: 4,  groupGap: 8,  rowPaddingY: 3,   cardPaddingY: 14, footerMarginTop: 10, footerPaddingTop: 8 },
];

export interface ResultadoDensidad {
  nivel: number;
  entra: boolean;
}

// alturas[i] = alto natural del contenido en el nivel i (puede ser parcial:
// solo los niveles medidos hasta ahora). Devuelve el primer nivel que entra;
// si ninguno entra, el último medido con entra=false. Sin mediciones o sin un
// alto disponible válido (nodo oculto, jsdom) no bloquea: nivel 0, entra.
export function elegirDensidad(alturas: readonly number[], disponible: number): ResultadoDensidad {
  if (alturas.length === 0 || !Number.isFinite(disponible) || disponible <= 0) {
    return { nivel: 0, entra: true };
  }
  const nivel = alturas.findIndex(h => h <= disponible);
  if (nivel >= 0) return { nivel, entra: true };
  return { nivel: alturas.length - 1, entra: false };
}
