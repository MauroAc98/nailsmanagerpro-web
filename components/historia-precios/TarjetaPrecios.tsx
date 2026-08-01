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
            {telefono && (
              <span
                style={{
                  marginTop: 3, fontSize: 9, fontWeight: 500,
                  color: tokens.nombreColor, opacity: 0.65, textAlign: 'center',
                }}
              >
                {t('reservarLabel')}: {telefono}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
