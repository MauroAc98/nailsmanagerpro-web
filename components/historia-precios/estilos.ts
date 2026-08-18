// Token sets para las 10 plantillas del catálogo de "historia de precios"
// (ver catalogo.ts) — reemplaza la vieja matriz de 3 EstiloTokens (classic/
// modern/bold) combinados con 3 layouts. Ahora cada plantilla es un look
// curado y fijo, con su propio token set.
//
// 2026-08-18: el mock v0 se actualizó — las 10 plantillas dejaron de tener
// un color hex único cada una y pasaron a reusar 5 "moods" compartidos
// tomados directo de los tokens --ag-* ya establecidos por el resto del
// rediseño agenda (ver theme/agendaColors.ts / .agenda-light en
// app/globals.css): surface (blanco), surface-2 (hueso cálido), primary-soft
// (rosa suave), strong (oscuro) y primary (rosa sólido, único para "bold").
// La diferenciación entre plantillas ahora viene principalmente de la
// COMPOSICIÓN (layouts/*.tsx: 1 foto, split, collage, polaroid, grid, sin
// foto), no de un color exclusivo por plantilla — varias comparten mood a
// propósito (ver comentarios de cada una abajo). Valores tomados de
// .agenda-light (no .agenda-dark) por el mismo motivo que primaryDeepRaw en
// theme/colors.ts: la imagen exportada es fija, no debe variar según el
// tema activo del usuario al momento de generarla.
//
// Tokens son valores string/number planos, nunca CSS custom properties
// (`var(--...)`). html-to-image serializa el nodo capturado a un SVG
// foreignObject y lo rasteriza a través de su propio <img> off-DOM —
// custom properties heredadas son justo el tipo de cosa que ese pipeline
// descarta silenciosamente. TarjetaPrecios lee estos valores directo como
// inline styles, mismo motivo que StoryCanvas hardcodea hex/rgba crudo en
// vez de leer theme/colors.ts. Ver design decision D3 en
// sdd/dynamic-price-story.

export interface EstiloTokens {
  cardBackground:   string;
  cardBorder:       string;
  headerColor:      string;
  nombreColor:      string;
  dividerColor:     string;
  precioColor:      string;
  precioFontWeight: number;
  letterSpacing:    number;
  // Opacidad del scrim oscuro que dibujan los layouts sobre la(s) foto(s)
  // de fondo, 0-1. Sin uso real en `estiloType` (sin foto de fondo, ver
  // LayoutTipografico) — queda en 0 por prolijidad de tipo, no porque algo
  // la lea.
  overlayOpacity:   number;
}

// Mood "surface" (--ag-surface, #ffffff) — tarjeta blanca translúcida,
// texto tinta oscura (--ag-strong, #2b2226). Compartido por editorial/
// split/polaroid (ver mock v0: mismas 3 usan `bg-ag-surface text-ag-strong`).
const AG_STRONG = '#2b2226';

// Editorial — foto + tarjeta blanca translúcida, texto tinta oscura.
export const estiloEditorial: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.68)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1,
  overlayOpacity:   0.32,
};

// Minimal — mood "surface-2" (--ag-surface-2, #f6f1ef), tarjeta hueso
// cálido translúcida, texto tinta oscura. Compartido con `type` (ver mock).
export const estiloMinimal: EstiloTokens = {
  cardBackground:   'rgba(246,241,239,0.62)',
  cardBorder:       'rgba(43,34,38,0.08)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.13)',
  precioColor:      AG_STRONG,
  precioFontWeight: 500,
  letterSpacing:    2,
  overlayOpacity:   0.22,
};

// Soft rose — mood "primary-soft" (--ag-primary-soft, #f3e4e6), tarjeta
// rosa suave translúcida, texto tinta oscura (antes era blanco sobre rosa
// saturado — el mock v0 actualizado pasó "rose" a un rosa mucho más claro
// con texto oscuro, no blanco). Compartido con `grid` (ver mock).
export const estiloRose: EstiloTokens = {
  cardBackground:   'rgba(243,228,230,0.65)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.14)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    2,
  overlayOpacity:   0.3,
};

// Modern — mood "strong" (--ag-strong, #2b2226 oscuro), tarjeta oscura
// translúcida, texto blanco (--ag-primary-fg). Tracking del header más
// amplio. Compartido con `collage` (ver mock).
export const estiloModern: EstiloTokens = {
  cardBackground:   'rgba(43,34,38,0.46)',
  cardBorder:       'rgba(255,255,255,0.2)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.18)',
  precioColor:      '#ffffff',
  precioFontWeight: 600,
  letterSpacing:    4,
  overlayOpacity:   0.46,
};

// Split — 2 fotos apiladas (ver LayoutSplit2), mood "surface" (misma tarjeta
// blanca que editorial/polaroid, ver mock).
export const estiloSplit: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.68)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1,
  overlayOpacity:   0.28,
};

// Bold — mood "primary" (--ag-primary, #c07d89), único entre las 10 (ver
// mock: es la única que usa `bg-ag-primary`), tarjeta rosa sólido
// translúcida, texto blanco, el peso de precio más pesado del catálogo.
export const estiloBold: EstiloTokens = {
  cardBackground:   'rgba(192,125,137,0.55)',
  cardBorder:       'rgba(255,255,255,0.22)',
  headerColor:      '#ffffff',
  nombreColor:      '#ffffff',
  dividerColor:     'rgba(255,255,255,0.2)',
  precioColor:      '#ffffff',
  precioFontWeight: 800,
  letterSpacing:    1,
  overlayOpacity:   0.42,
};

// Collage — 3 fotos (ver LayoutCollage), mood "strong" (misma tarjeta
// oscura que modern, ver mock).
export const estiloCollage: EstiloTokens = {
  cardBackground:   'rgba(43,34,38,0.5)',
  cardBorder:       'rgba(255,255,255,0.18)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.18)',
  precioColor:      '#ffffff',
  precioFontWeight: 700,
  letterSpacing:    2,
  overlayOpacity:   0.4,
};

// Polaroid — foto de fondo + 1 acento polaroid rotado (ver LayoutPolaroid),
// mood "surface" (misma tarjeta blanca que editorial/split, ver mock),
// sensación "boutique" por la composición, no por el color.
export const estiloPolaroid: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.68)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 500,
  letterSpacing:    1.5,
  overlayOpacity:   0.3,
};

// Tipográfico — sin foto de fondo (ver LayoutTipografico), mood
// "surface-2" (misma tarjeta hueso que minimal, ver mock) pero OPACA (no
// translúcida como el resto: no hay nada detrás que se filtre) y
// `overlayOpacity` queda sin uso.
export const estiloType: EstiloTokens = {
  cardBackground:   '#f6f1ef',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.14)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    2,
  overlayOpacity:   0,
};

// Mosaico — 4 fotos en grilla pareja (ver LayoutGrid4 reescrito), mood
// "primary-soft" (misma tarjeta rosa suave que rose, ver mock).
export const estiloGrid: EstiloTokens = {
  cardBackground:   'rgba(243,228,230,0.65)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.14)',
  precioColor:      AG_STRONG,
  precioFontWeight: 700,
  letterSpacing:    1.5,
  overlayOpacity:   0.34,
};
