import type { ReactNode } from 'react';

// Iconos de linea del tablero (24x24, trazo redondeado). Decorativos: van
// aria-hidden, el texto vecino es el nombre accesible.
function Ico({ size = 16, color, sw = 2, children }: { size?: number; color: string; sw?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

type P = { size?: number; color: string; sw?: number };

export const IcoPin = (p: P) => (
  <Ico {...p}>
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </Ico>
);
export const IcoCalendario = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Ico>
);
export const IcoBrillo = (p: P) => (
  <Ico {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </Ico>
);
export const IcoEscudo = (p: P) => (
  <Ico {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <polyline points="9 12 11 14 15 10" />
  </Ico>
);
export const IcoCheck = (p: P) => (
  <Ico {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
export const IcoReloj = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </Ico>
);
export const IcoCandado = (p: P) => (
  <Ico {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Ico>
);
export const IcoImagen = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </Ico>
);
export const IcoMas = (p: P) => (
  <Ico {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Ico>
);
export const IcoAtras = (p: P) => (
  <Ico {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Ico>
);
export const IcoGlobo = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Ico>
);
