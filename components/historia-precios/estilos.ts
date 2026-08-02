// Estilo (card style) token sets for the price-story picker — 3 curated
// looks (classic/modern/bold) combined with 3 layouts (see catalogo.ts) for
// the fixed 9-combination catalog described in spec price-story-templates.
//
// Tokens are plain string/number values, never CSS custom properties
// (`var(--...)`). html-to-image serializes the captured node into an SVG
// foreignObject and rasterizes it through its own off-DOM <img> — inherited
// custom properties are exactly the kind of thing that pipeline drops
// silently. TarjetaPrecios reads these values directly as inline styles,
// the same reason StoryCanvas hardcodes raw hex/rgba instead of reading
// theme/colors.ts. See design decision D3 in sdd/dynamic-price-story.
// (primaryDeepRaw ya no se importa acá: bold pasó de sólido a rgba() con
// alpha propio, ver comentario en estiloBold más abajo.)

export interface EstiloTokens {
  cardBackground:   string;
  cardBorder:       string;
  headerColor:      string;
  nombreColor:      string;
  dividerColor:     string;
  precioColor:      string;
  precioFontWeight: number;
  letterSpacing:    number;
  // Opacity of the dark scrim layouts draw over the background photo(s)
  // (see LayoutGrid4/LayoutSingle/LayoutSplit2), 0-1. An opaque light card
  // like classic doesn't need the photo dimmed for text legibility — it
  // already sits on its own solid background — while modern/bold's
  // translucent/photo-adjacent treatments still do. Per-style instead of
  // a shared constant so classic can differ without touching the other two.
  overlayOpacity:   number;
}

// Classic — light glass card (not opaque), monochrome ink price (weight
// carries the emphasis instead of color — see design review), generous
// letter spacing on the header (echoes a printed price list).
// Alpha bajada (0.92->0.5 fondo, 0.08->0.06 borde) a pedido — la card leía
// "opaca" en vez de delicada. El primer overlayOpacity (0.22) no alcanzó:
// contra un collage de fotos claras (piel/fondos blancos) el texto del
// collage se filtraba a través de la card y competía con el texto propio
// de la lista — ver captura de pantalla. overlayOpacity subido a 0.4 (el
// collage queda notoriamente más oscuro/desaturado de fondo) y el fondo de
// la card subido a 0.68 (sigue siendo translúcido, no opaco) para que el
// texto oscuro tenga suficiente base sólida sin depender del overlay solo.
export const estiloClassic: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.68)',
  cardBorder:       'rgba(0,0,0,0.08)',
  headerColor:      '#2b2b2b',
  nombreColor:      '#3a3a3a',
  dividerColor:     'rgba(0,0,0,0.11)',
  precioColor:      '#2b2b2b',
  // 700->600: el nombre subió a 600 (ver TarjetaPrecios), el precio no
  // debe seguir siendo el elemento más pesado de la fila.
  precioFontWeight: 600,
  letterSpacing:    2,
  overlayOpacity:   0.4,
};

// Modern — dark glass card over the background photo, white text, wide
// tracked header. Mirrors StoryCanvas's own translucent-panel treatment.
export const estiloModern: EstiloTokens = {
  // Alpha bajada de nuevo (0.75->0.42 fondo, 0.4->0.2 borde) a pedido — más
  // delicada/transparente. Para no reintroducir el problema documentado
  // abajo (panel indistinguible del fondo en foto casi negra), esta vez el
  // overlayOpacity sube en vez del alpha de la card: la foto de base queda
  // más oscura ANTES de que el glass panel, ahora más claro, se dibuje
  // encima — mantiene el panel visible sin volver a subirle el alpha.
  cardBackground:   'rgba(15,15,20,0.42)',
  cardBorder:       'rgba(255,255,255,0.2)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.3)',
  precioColor:      '#ffffff',
  precioFontWeight: 600,
  letterSpacing:    4,
  overlayOpacity:   0.46,
};

// Bold — brand-color card, heaviest price weight of the 3 styles. Color
// base es primaryDeepRaw (#a85568, ver theme/colors.ts) escrito acá como
// rgb() explícito porque un hex de 6 dígitos no admite alpha por sufijo y
// esta card no puede usar color-mix()/var() (string plano, ver D3 arriba)
// — si primaryDeepRaw cambia algún día, este valor hay que actualizarlo a
// mano. Con blanco, ~5:1 de contraste (pasa AA) a diferencia de primaryRaw
// (el rosa pastel, ~2.25:1, no pasa ni el umbral relajado de texto grande).
// Alpha bajada acá también (0.5, era sólido) — decisión revertida: se había
// dejado bold opaco a propósito para diferenciarlo, pero el pedido pasó a
// ser consistencia total con el formato delicado de classic/modern. Mismo
// truco que en modern: overlayOpacity sube (0.38->0.46) para compensar en
// vez de subir el alpha de la card.
export const estiloBold: EstiloTokens = {
  cardBackground:   'rgba(168,85,104,0.5)',
  cardBorder:       'rgba(255,255,255,0.22)',
  headerColor:      '#ffffff',
  nombreColor:      '#ffffff',
  dividerColor:     'rgba(255,255,255,0.5)',
  precioColor:      '#ffffff',
  precioFontWeight: 800,
  letterSpacing:    1,
  overlayOpacity:   0.46,
};
