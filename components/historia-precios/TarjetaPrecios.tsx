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
export function TarjetaPrecios({ tokens, servicios }: Props) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        padding: '20px 18px 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          padding: '18px 16px', borderRadius: 20,
          background: tokens.cardBackground,
          border: `1px solid ${tokens.cardBorder}`,
        }}
      >
        <span
          style={{
            fontSize: 15, fontWeight: 700, letterSpacing: tokens.letterSpacing,
            color: tokens.headerColor, textAlign: 'center', marginBottom: 12,
            textTransform: 'uppercase',
          }}
        >
          Lista de precios
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {servicios.map(servicio => (
            <div
              key={servicio.id}
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}
            >
              <span
                style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
                  color: tokens.nombreColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {servicio.nombre}
              </span>
              <div style={{ flex: 1, minWidth: 8, borderBottom: `1px dotted ${tokens.dividerColor}`, marginBottom: 4 }} />
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
