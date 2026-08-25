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
// 2026-08-19 (corrección): 0.68/0.65 quedó demasiado transparente — subida a
// 0.76/0.73. Sigue por debajo del 0.88/0.85 original (el pedido de que se
// note el fondo seguía en pie), pero recupera legibilidad del texto sobre la
// tarjeta.
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
  // true en las 6 plantillas de tarjeta clara/tinta oscura (feature/split/
  // grid/collage/catalog/listphoto), false en las 2 de tarjeta oscura/tinta
  // clara (fullbleed/beforeafter). TarjetaPrecios lo usa para elegir la
  // variante clara u oscura del acento grafito fijo (ver ACCENT/
  // ACCENT_INVERTIDO ahí) — un acento oscuro fijo quedaba invisible/"muy
  // oscuro" sobre las 2 tarjetas oscuras, que ya usan texto blanco en todo
  // lo demás (feedback real, con captura).
  claro: boolean;
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
  cardBackground:   'rgba(255,255,255,0.76)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1,
  overlayOpacity:   0.32,
  claro:            true,
};

// Full bleed — foto de fondo nítida, SIN blur (ver LayoutFullBleed — la
// foto es la publicidad del trabajo, tiene que verse nítida, no
// desenfocada). Tarjeta sin bordes redondeados marcados ni sombra (ver
// TarjetaPrecios variante 'panel' — solo cambia el chrome, no el alto/
// posición). Paleta propia, deliberadamente fuera del sistema de 5 moods
// compartidos del resto del catálogo — carbón y blanco cálido, pensada para
// leer "profesional/universal" en vez de "belleza/uñas". Texto claro sobre
// scrim oscuro (no tinta oscura sobre tarjeta clara como el resto).
// cardBackground subido de 0.5 a 0.72 (2026-08-18, séptima actualización):
// al sacar el blur, la tarjeta sola tiene que sostener la legibilidad
// contra una foto nítida, no puede seguir tan traslúcida.
// 2026-08-24: precioColor pasado de un acento terracota propio ('#e0a483')
// a blanco puro — a pedido del usuario, para estandarizar con el resto del
// catálogo: grafito (AG_STRONG) en las 6 plantillas de tarjeta clara, blanco
// puro en las 2 de tarjeta oscura (mismo valor que ya usaba estiloBeforeAfter,
// la otra plantilla oscura).
export const estiloFullBleed: EstiloTokens = {
  cardBackground:   'rgba(18,15,14,0.72)',
  cardBorder:       'rgba(255,255,255,0.14)',
  headerColor:      '#faf7f2',
  nombreColor:      'rgba(250,247,242,0.82)',
  dividerColor:     'rgba(255,255,255,0.16)',
  precioColor:      '#ffffff',
  precioFontWeight: 700,
  letterSpacing:    1,
  // Bajado de 0.5 a 0.18: ese scrim cubre TODA la foto (LayoutFullBleed usa
  // el mismo mecanismo que LayoutSingle), no solo detrás de la tarjeta —
  // con 0.5 se oscurecía también el margen de foto visible alrededor de la
  // tarjeta centrada, en contra de la premisa de que la foto se vea como
  // publicidad. La legibilidad del texto la sostiene la opacidad de la
  // tarjeta (0.72), no el scrim general.
  overlayOpacity:   0.18,
  claro:            false,
};

// Doble mirada — 2 fotos apiladas (ver LayoutSplit2), mood "surface",
// tarjeta centrada (align: 'center').
export const estiloSplit: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.76)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1,
  overlayOpacity:   0.28,
  claro:            true,
};

// Antes / después — 2 fotos apiladas (ver LayoutBeforeAfter), mood "strong"
// (oscuro, dramático — coherente con mostrar un proceso/transformación),
// tarjeta centrada. Tracking del header más amplio (3, como el modern
// anterior) para reforzar el tono editorial.
// cardBackground subido de 0.58 a 0.74 (feedback real, con captura: "mucha
// transparencia") — era la única del catálogo notablemente por debajo del
// resto (fullbleed, la otra tarjeta oscura, ya estaba en 0.72; el resto
// entre 0.73/0.76), dejaba el texto compitiendo demasiado contra las 2
// fotos apiladas de fondo. Alineado al mismo nivel que fullbleed, no un
// valor nuevo inventado.
export const estiloBeforeAfter: EstiloTokens = {
  cardBackground:   'rgba(43,34,38,0.74)',
  cardBorder:       'rgba(255,255,255,0.2)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.18)',
  precioColor:      '#ffffff',
  precioFontWeight: 700,
  letterSpacing:    3,
  overlayOpacity:   0.42,
  claro:            false,
};

// Editorial — 3 fotos (ver LayoutCollage), mood "surface-2" (tarjeta hueso
// cálido), tarjeta centrada.
// cardBackground subido de 0.73 a 0.87 (feedback real, con captura: "el
// estilo de mosaico de las fotos" se ve feo) — a diferencia de un fondo de 1
// sola foto (LayoutSingle) al mismo 0.73, acá son 3 fotos distintas en
// grilla ajustada (hero + 2 apiladas) compitiendo entre sí Y contra el
// texto; la misma transparencia que funciona con una foto coherente se lee
// "ocupada"/desprolija con un mosaico. Más opacidad, no blur (ya probado y
// rechazado: desenfocar la foto entera la vuelve irreconocible).
export const estiloCollage: EstiloTokens = {
  cardBackground:   'rgba(246,241,239,0.87)',
  cardBorder:       'rgba(43,34,38,0.08)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.13)',
  precioColor:      AG_STRONG,
  precioFontWeight: 700,
  letterSpacing:    2,
  overlayOpacity:   0.46,
  claro:            true,
};

// Portafolio — 4 fotos en grilla pareja (ver LayoutGrid4), mood "surface",
// tarjeta centrada.
// cardBackground subido de 0.76 a 0.87 (feedback real, con captura: "muy
// oscuras algunas letras") — mismo motivo que estiloCollage: grilla de 4
// fotos distintas compitiendo entre sí y contra el texto hace que la misma
// transparencia que funciona con 1 sola foto se lea desprolija/con
// contraste irregular según qué haya debajo de cada línea.
export const estiloGrid: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.87)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.15)',
  precioColor:      AG_STRONG,
  precioFontWeight: 700,
  letterSpacing:    1.5,
  overlayOpacity:   0.4,
  claro:            true,
};

// Catálogo — MISMA composición de 4 fotos que Portafolio (reusa
// LayoutGrid4, ver catalogo.ts) — se diferencia solo por mood ("primary-soft",
// rosa suave, en vez de blanco) y anclaje (align: 'start', tarjeta arriba en
// vez de centrada), no por layout. Mismo criterio que el mock v0 (grid/
// catalog comparten composición de fotos ahí también).
// cardBackground subido de 0.73 a 0.87 — mismo motivo y mismo valor que
// estiloGrid (feedback real: "se encuentra muy transparente"), comparten
// exactamente la misma composición de 4 fotos (LayoutGrid4).
export const estiloCatalog: EstiloTokens = {
  cardBackground:   'rgba(243,228,230,0.87)',
  cardBorder:       'rgba(43,34,38,0.10)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.14)',
  precioColor:      AG_STRONG,
  precioFontWeight: 600,
  letterSpacing:    1.5,
  overlayOpacity:   0.34,
  claro:            true,
};

// Lista + foto — 1 foto (ver LayoutSingle, MISMO componente que Protagonista
// — se diferencian por mood/anclaje, no por composición), mood "surface-2",
// tarjeta anclada ARRIBA (align: 'start') y el precio más "pesado" del
// catálogo (peso 800) — la nota del picker ("Precios primero") se refleja
// en que el precio es lo que más grita tipográficamente acá.
export const estiloListPhoto: EstiloTokens = {
  cardBackground:   'rgba(246,241,239,0.73)',
  cardBorder:       'rgba(43,34,38,0.08)',
  headerColor:      AG_STRONG,
  nombreColor:      'rgba(43,34,38,0.75)',
  dividerColor:     'rgba(43,34,38,0.13)',
  precioColor:      AG_STRONG,
  precioFontWeight: 800,
  letterSpacing:    0.5,
  overlayOpacity:   0.3,
  claro:            true,
};
