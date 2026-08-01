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
import { primaryDeepRaw } from '@/theme/colors';

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

// Classic — light opaque card, monochrome ink price (weight carries the
// emphasis instead of color — see design review), generous letter spacing
// on the header (echoes a printed price list).
export const estiloClassic: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.92)',
  cardBorder:       'rgba(0,0,0,0.08)',
  headerColor:      '#2b2b2b',
  nombreColor:      '#3a3a3a',
  dividerColor:     'rgba(0,0,0,0.11)',
  precioColor:      '#2b2b2b',
  // 700->600: el nombre subió a 600 (ver TarjetaPrecios), el precio no
  // debe seguir siendo el elemento más pesado de la fila.
  precioFontWeight: 600,
  letterSpacing:    2,
  overlayOpacity:   0.1,
};

// Modern — dark glass card over the background photo, white text, wide
// tracked header. Mirrors StoryCanvas's own translucent-panel treatment.
export const estiloModern: EstiloTokens = {
  // Alpha subida (0.55->0.75 fondo, 0.18->0.4 borde) — contra una foto casi
  // negra el panel se volvía indistinguible del fondo aunque el texto
  // blanco siguiera legible (contraste tarjeta/fondo ~1.05:1 antes del
  // ajuste, ver design review). El texto en sí nunca fue el problema.
  cardBackground:   'rgba(15,15,20,0.75)',
  cardBorder:       'rgba(255,255,255,0.4)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.3)',
  precioColor:      '#ffffff',
  precioFontWeight: 600,
  letterSpacing:    4,
  overlayOpacity:   0.38,
};

// Bold — solid brand-color card (primaryDeepRaw, not colors.primaryDeep —
// same CSS-var caveat as above), heaviest price weight of the 3 styles.
// Uses the DEEP variant, not primaryRaw's pastel pink: white text on
// primaryRaw computes to ~2.25:1 contrast (fails WCAG AA's 4.5:1, and even
// the relaxed 3:1 large-text threshold) — the same "pastel isn't enough
// for text" problem the app already solved elsewhere (see the comment on
// colors.primaryDeep). primaryDeepRaw computes to ~5:1, passes AA.
export const estiloBold: EstiloTokens = {
  cardBackground:   primaryDeepRaw,
  cardBorder:       'rgba(255,255,255,0.4)',
  headerColor:      '#ffffff',
  nombreColor:      '#ffffff',
  dividerColor:     'rgba(255,255,255,0.5)',
  precioColor:      '#ffffff',
  precioFontWeight: 800,
  letterSpacing:    1,
  overlayOpacity:   0.38,
};
