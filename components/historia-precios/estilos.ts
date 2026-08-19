// Token sets para las 8 plantillas del catálogo de "historia de precios"
// (ver catalogo.ts) — reemplaza la vieja matriz de 3 EstiloTokens (classic/
// modern/bold) combinados con 3 layouts. Ahora cada plantilla es un look
// curado y fijo, con su propio token set.
//
// 2026-08-18: el mock v0 se actualizó — las plantillas dejaron de tener
// un color hex único cada una y pasaron a reusar 5 "moods" compartidos
// tomados directo de los tokens --ag-* ya establecidos por el resto del
// rediseño agenda (ver theme/agendaColors.ts / .agenda-light en
// app/globals.css): surface (blanco), surface-2 (hueso cálido), primary-soft
// (rosa suave), strong (oscuro) y primary (rosa sólido, sin uso actual).
// La diferenciación entre plantillas ahora viene principalmente de la
// COMPOSICIÓN (layouts/*.tsx: 1 foto, split, collage, panel full bleed,
// grid, sin foto), no de un color exclusivo por plantilla — varias comparten
// mood a propósito (ver comentarios de cada una abajo). Valores tomados de
// .agenda-light (no .agenda-dark) por el mismo motivo que primaryDeepRaw en
// theme/colors.ts: la imagen exportada es fija, no debe variar según el
// tema activo del usuario al momento de generarla.
//
// 2026-08-18 (segunda actualización): el mock v0 se volvió a actualizar — el
// catálogo bajó de 10 a 8 plantillas (se sacaron rose/bold/polaroid) y
// collage/type/grid cambiaron de mood (ver comentarios de cada una abajo).
//
// 2026-08-18 (tercera actualización): "polaroid"/"frame" se reemplazó por
// "fullbleed" — ya no es una variación de composición sobre el mismo mood
// compartido, es una plantilla con paleta propia y una variante de panel
// distinta en TarjetaPrecios (ver estiloFullBleed abajo y
// TarjetaPrecios.tsx prop `variante`).
//
// 2026-08-18 (octava actualización): el mock v0 se refrescó una vez más con
// un catálogo de 8 plantillas totalmente nuevo (feature/fullbleed/split/
// beforeafter/collage/grid/catalog/listphoto — ver catalogo.ts). Esta vez NO
// se portó literal la composición del mock para `feature`/`catalog`/
// `listphoto` (el mock las confina a una franja de foto fija con panel
// abajo) — esa exact idea ya rompió dos veces hoy con listas de precios
// reales largas (el panel se quedaba corto o el contenido se metía en la
// franja de la foto). En su lugar, TODAS las plantillas le dan a la tarjeta
// el alto COMPLETO del canvas (mismo patrón ya probado de editorial/modern/
// fullbleed) y la variedad visual sale de la posición de anclaje
// (`TarjetaPrecios` prop `align`: arriba/centro/abajo), la composición de
// fotos (1/2/3/4) y el mood de color — nunca de confinar la altura
// disponible. `fullbleed` mantiene su implementación intacta (ya arreglada
// hoy: sin blur, foto nítida, paleta propia).
//
// 2026-08-19: opacidad de las tarjetas CLARAS (feature/split/grid: 0.88,
// collage/catalog/listphoto: 0.85) bajada a 0.68/0.65 — a pedido del
// usuario, para que el trabajo de fondo se note más a través de la tarjeta.
// `fullbleed` y `beforeafter` (tarjetas oscuras) no se tocaron: fullbleed ya
// tiene su propia razón documentada abajo para sostener 0.72 (sin blur, la
// tarjeta sola sostiene la legibilidad).
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
  // de fondo, 0-1.
  overlayOpacity:   number;
}

// Mood "surface" (--ag-surface, #ffffff) — tarjeta blanca translúcida,
// texto tinta oscura (--ag-strong, #2b2226). Compartido por feature/split/
// grid.
const AG_STRONG = '#2b2226';

// Protagonista — 1 foto (ver LayoutSingle), mood "surface", tarjeta
// anclada ABAJO (align: 'end', ver catalogo.ts) — deja que la foto
// "respire" arriba, coherente con el nombre: el trabajo es el protagonista,
// la tarjeta de precios queda como pie de página.
export const estiloFeature: EstiloTokens = {
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

// Full bleed — foto de fondo nítida, SIN blur (ver LayoutFullBleed — la
// foto es la publicidad del trabajo, tiene que verse nítida, no
// desenfocada). Tarjeta sin bordes redondeados marcados ni sombra (ver
// TarjetaPrecios variante 'panel' — solo cambia el chrome, no el alto/
// posición). Paleta propia, deliberadamente fuera del sistema de 5 moods
// compartidos del resto del catálogo — carbón, blanco cálido, y un único
// acento terracota (no rosa), pensada para leer "profesional/universal" en
// vez de "belleza/uñas". Texto claro sobre scrim oscuro (no tinta oscura
// sobre tarjeta clara como el resto). cardBackground subido de 0.5 a 0.72
// (2026-08-18, séptima actualización): al sacar el blur, la tarjeta sola
// tiene que sostener la legibilidad contra una foto nítida, no puede seguir
// tan traslúcida.
export const estiloFullBleed: EstiloTokens = {
  cardBackground:   'rgba(18,15,14,0.72)',
  cardBorder:       'rgba(255,255,255,0.14)',
  headerColor:      '#faf7f2',
  nombreColor:      'rgba(250,247,242,0.82)',
  dividerColor:     'rgba(255,255,255,0.16)',
  precioColor:      '#e0a483',
  precioFontWeight: 700,
  letterSpacing:    1,
  // Bajado de 0.5 a 0.18: ese scrim cubre TODA la foto (LayoutFullBleed usa
  // el mismo mecanismo que LayoutSingle), no solo detrás de la tarjeta —
  // con 0.5 se oscurecía también el margen de foto visible alrededor de la
  // tarjeta centrada, en contra de la premisa de que la foto se vea como
  // publicidad. La legibilidad del texto la sostiene la opacidad de la
  // tarjeta (0.72), no el scrim general.
  overlayOpacity:   0.18,
};

// Doble mirada — 2 fotos apiladas (ver LayoutSplit2), mood "surface",
// tarjeta centrada (align: 'center').
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

// Antes / después — 2 fotos apiladas (ver LayoutBeforeAfter), mood "strong"
// (oscuro, dramático — coherente con mostrar un proceso/transformación),
// tarjeta centrada. Tracking del header más amplio (3, como el modern
// anterior) para reforzar el tono editorial.
export const estiloBeforeAfter: EstiloTokens = {
  cardBackground:   'rgba(43,34,38,0.58)',
  cardBorder:       'rgba(255,255,255,0.2)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.18)',
  precioColor:      '#ffffff',
  precioFontWeight: 700,
  letterSpacing:    3,
  overlayOpacity:   0.42,
};

// Editorial — 3 fotos (ver LayoutCollage), mood "surface-2" (tarjeta hueso
// cálido), tarjeta centrada.
export const estiloCollage: EstiloTokens = {
  cardBackground:   'rgba(246,241,239,0.65)',
  cardBorder:       'rgba(43,34,38,0.08)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.13)',
  precioColor:      AG_STRONG,
  precioFontWeight: 700,
  letterSpacing:    2,
  overlayOpacity:   0.46,
};

// Portafolio — 4 fotos en grilla pareja (ver LayoutGrid4), mood "surface",
// tarjeta centrada.
export const estiloGrid: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.68)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 700,
  letterSpacing:    1.5,
  overlayOpacity:   0.4,
};

// Catálogo — MISMA composición de 4 fotos que Portafolio (reusa
// LayoutGrid4, ver catalogo.ts) — se diferencia solo por mood ("primary-soft",
// rosa suave, en vez de blanco) y anclaje (align: 'start', tarjeta arriba en
// vez de centrada), no por layout. Mismo criterio que el mock v0 (grid/
// catalog comparten composición de fotos ahí también).
export const estiloCatalog: EstiloTokens = {
  cardBackground:   'rgba(243,228,230,0.65)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.14)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1.5,
  overlayOpacity:   0.34,
};

// Lista + foto — 1 foto (ver LayoutSingle, MISMO componente que Protagonista
// — se diferencian por mood/anclaje, no por composición), mood "surface-2",
// tarjeta anclada ARRIBA (align: 'start') y el precio más "pesado" del
// catálogo (peso 800) — la nota del picker ("Precios primero") se refleja
// en que el precio es lo que más grita tipográficamente acá.
export const estiloListPhoto: EstiloTokens = {
  cardBackground:   'rgba(246,241,239,0.65)',
  cardBorder:       'rgba(43,34,38,0.08)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.13)',
  precioColor:      AG_STRONG,
  precioFontWeight: 800,
  letterSpacing:    0.5,
  overlayOpacity:   0.3,
};
