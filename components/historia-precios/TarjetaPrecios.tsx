import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
import { EstiloTokens } from './estilos';

const formatoPrecio = new Intl.NumberFormat('es-AR');
const formatearPrecio = (precio: string | null): string =>
  precio ? `$${formatoPrecio.format(Number(precio))}` : '-';

interface Props {
  tokens:    EstiloTokens;
  // Already-filtered active list (activo: true) — TarjetaPrecios does not
  // filter or read the store itself, it's purely presentational (see
  // architecture constraint for this phase). `es_promo` services render
  // through the exact same row as regular ones: no badge, no distinct
  // styling — v1 has no visual promo treatment (spec: price-story,
  // "Generated image reflects live service data").
  servicios: Servicio[];
  // Account/business name (`User.name`, useAuthStore — NOT `Profesional`,
  // a different concept) and phone (`User.telefono`). Threaded down from
  // useHistoriaPrecios through every layer, purely presentational here.
  nombreNegocio: string;
  telefono:      string | null;
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

export function TarjetaPrecios({ tokens, servicios, nombreNegocio, telefono }: Props) {
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
          padding: '24px 20px', borderRadius: 10,
          background: tokens.cardBackground,
          border: `1px solid ${tokens.cardBorder}`,
          // Sombra más sutil (era 4px/16px blur — 5x más difusa que
          // --shadow-card del resto de la app) para leer "carta de precios"
          // en vez de "banner". Ver design review.
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif-display), serif',
            // 700->600: al peso completo el serif se vuelve un titular
            // asertivo en vez de delicado — Playfair ya tiene suficiente
            // presencia en peso medio por su propio contraste de trazo.
            fontSize: 30, fontWeight: 600, letterSpacing: tokens.letterSpacing,
            color: tokens.headerColor, textAlign: 'center', marginBottom: 14,
          }}
        >
          {t('header')}
        </span>

        {/* Filete fino centrado bajo el título en vez de solo espacio en
            blanco — tratamiento clásico de carta/menú boutique. */}
        <div
          style={{
            width: 48, height: 1, margin: '0 auto 22px',
            background: tokens.dividerColor,
          }}
        />

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
              {/* Nombre con un poco más de peso, precio con un poco menos
                  — la jerarquía estaba invertida (precio más grande Y más
                  negrita que el nombre del servicio). */}
              <span
                style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600,
                  color: tokens.nombreColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {servicio.nombre}
              </span>
              <span
                style={{
                  fontSize: 13, fontWeight: tokens.precioFontWeight, color: tokens.precioColor,
                  letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatearPrecio(servicio.precio)}
              </span>
            </div>
          ))}
        </div>

        {/* Footer credit line — same slot the reference Canva price-list
            used for a professional's @handle, repurposed for the account's
            business name + phone (see useHistoriaPrecios: `User.name`/
            `User.telefono` via useAuthStore, not `Profesional`). Guarded on
            nombreNegocio so a not-yet-loaded/empty account never renders a
            bare divider over nothing. */}
        {nombreNegocio && (
          <>
            <div
              style={{
                width: 48, height: 1, margin: '18px auto 0',
                background: tokens.dividerColor,
              }}
            />
            <span
              style={{
                marginTop: 10, fontSize: 11, fontWeight: 600, letterSpacing: 1,
                color: tokens.nombreColor, textAlign: 'center',
              }}
            >
              {nombreNegocio}
            </span>
            {/* CTA + phone — same visual language as StoryCanvas's footer
                (thin/wide-tracked uppercase label + icon-paired phone row),
                adapted to per-estilo tokens instead of hardcoded white:
                classic's opaque light card would make white text invisible.
                See StoryCanvas.tsx lines ~238-257 for the reference. */}
            {telefono && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    fontSize: 8, fontWeight: 300, letterSpacing: 3, textTransform: 'uppercase',
                    color: tokens.nombreColor, opacity: 0.65,
                  }}
                >
                  {t('reservarLabel')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.65 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={tokens.nombreColor} xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 500, letterSpacing: 0.5,
                      color: tokens.nombreColor,
                    }}
                  >
                    {telefono}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
