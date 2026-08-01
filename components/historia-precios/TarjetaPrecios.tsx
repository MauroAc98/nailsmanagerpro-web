import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
import { EstiloTokens } from './estilos';

interface Props {
  tokens:    EstiloTokens;
  // Already-filtered active list (activo: true) — TarjetaPrecios does not
  // filter or read the store itself, it's purely presentational (see
  // architecture constraint for this phase). `es_promo` services render
  // through the exact same row as regular ones: no badge, no distinct
  // styling — v1 has no visual promo treatment (spec: price-story,
  // "Generated image reflects live service data").
  servicios: Servicio[];
}

// TarjetaPrecios — price list panel, rendered as the foreground `children`
// of whichever layout (LayoutGrid4/LayoutSingle/LayoutSplit2) is active.
// Tokens arrive as plain values (hex/rgba strings), never CSS custom
// properties — html-to-image serializes the captured node into an SVG
// foreignObject and silently drops inherited `var(...)` custom properties,
// the same reason StoryCanvas hardcodes its own raw colors instead of
// reading theme/colors.ts. See design decision D3.
// Card horizontal padding at BASE_WIDTH (420, see HistoriaPreciosCanvas.tsx)
// — lands the card at ~73% of the canvas width, matching the reference
// Canva price-list's narrower, more deliberate card vs. the previous
// near-edge-to-edge (~91%) layout.
const OUTER_PADDING_X = 54;

export function TarjetaPrecios({ tokens, servicios }: Props) {
  const t = useTranslations('historia.TarjetaPrecios');
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        padding: `20px ${OUTER_PADDING_X}px 16px`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          padding: '24px 20px', borderRadius: 7,
          background: tokens.cardBackground,
          border: `1px solid ${tokens.cardBorder}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif-display), serif',
            fontSize: 30, fontWeight: 700, letterSpacing: tokens.letterSpacing,
            color: tokens.headerColor, textAlign: 'center', marginBottom: 22,
          }}
        >
          {t('header')}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {servicios.map((servicio, index) => (
            <div
              key={servicio.id}
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
                paddingBottom: index === servicios.length - 1 ? 0 : 7,
                borderBottom: index === servicios.length - 1 ? 'none' : `1px solid ${tokens.dividerColor}`,
              }}
            >
              <span
                style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
                  color: tokens.nombreColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {servicio.nombre}
              </span>
              <span
                style={{
                  fontSize: 13, fontWeight: tokens.precioFontWeight, color: tokens.precioColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {servicio.precio ? `$${servicio.precio}` : '-'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
