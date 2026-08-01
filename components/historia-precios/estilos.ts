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
import { primaryRaw } from '@/theme/colors';

export interface EstiloTokens {
  cardBackground:   string;
  cardBorder:       string;
  headerColor:      string;
  nombreColor:      string;
  dividerColor:     string;
  precioColor:      string;
  precioFontWeight: number;
  letterSpacing:    number;
}

// Classic — light translucent card, warm accent price, generous letter
// spacing on the header (echoes a printed price list).
export const estiloClassic: EstiloTokens = {
  cardBackground:   'rgba(255,255,255,0.92)',
  cardBorder:       'rgba(0,0,0,0.08)',
  headerColor:      '#2b2b2b',
  nombreColor:      '#3a3a3a',
  dividerColor:     'rgba(0,0,0,0.25)',
  precioColor:      '#b5793f',
  precioFontWeight: 700,
  letterSpacing:    2,
};

// Modern — dark glass card over the background photo, white text, wide
// tracked header. Mirrors StoryCanvas's own translucent-panel treatment.
export const estiloModern: EstiloTokens = {
  cardBackground:   'rgba(15,15,20,0.55)',
  cardBorder:       'rgba(255,255,255,0.18)',
  headerColor:      '#ffffff',
  nombreColor:      'rgba(255,255,255,0.85)',
  dividerColor:     'rgba(255,255,255,0.3)',
  precioColor:      '#ffffff',
  precioFontWeight: 600,
  letterSpacing:    4,
};

// Bold — solid brand-color card (primaryRaw, not colors.primary — same
// CSS-var caveat as above), heaviest price weight of the 3 styles.
export const estiloBold: EstiloTokens = {
  cardBackground:   primaryRaw,
  cardBorder:       'rgba(255,255,255,0.4)',
  headerColor:      '#ffffff',
  nombreColor:      '#ffffff',
  dividerColor:     'rgba(255,255,255,0.5)',
  precioColor:      '#ffffff',
  precioFontWeight: 800,
  letterSpacing:    1,
};
