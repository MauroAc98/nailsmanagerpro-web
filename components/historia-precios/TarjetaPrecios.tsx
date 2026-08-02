import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
import { EstiloTokens } from './estilos';

const formatoPrecio = new Intl.NumberFormat('es-AR');
// Espacio entre "$" y el número (antes pegados) — separa el signo del
// monto como en la referencia, en vez de leerse como un solo token.
const formatearPrecio = (precio: string | null): string =>
  precio ? `$ ${formatoPrecio.format(Number(precio))}` : '-';

interface Props {
  tokens:    EstiloTokens;
  // Card title — resolved by the caller (page.tsx) from `modo`
  // ('precios' | 'promociones', see useHistoriaPrecios), not looked up
  // internally, since TarjetaPrecios has no notion of modo itself.
  titulo:    string;
  // Already-filtered list (activo: true AND es_promo matching the active
  // modo, see useHistoriaPrecios.serviciosActivos) — TarjetaPrecios does
  // not filter or read the store itself, it's purely presentational (see
  // architecture constraint for this phase).
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

export function TarjetaPrecios({ tokens, titulo, servicios, nombreNegocio, telefono }: Props) {
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
          padding: '24px 20px', borderRadius: 18,
          background: tokens.cardBackground,
          border: `1px solid ${tokens.cardBorder}`,
          // Sombra más sutil (era 4px/16px blur — 5x más difusa que
          // --shadow-card del resto de la app) para leer "carta de precios"
          // en vez de "banner". Ver design review.
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          // Montserrat para todo el cuerpo (nombre/precio/footer) en vez de
          // la sans del sistema — el título (Cormorant, serif) ya tenía
          // fuente propia, el resto del contenido no. Puesto acá una sola
          // vez en el contenedor en vez de en cada span para que herede.
          fontFamily: 'var(--font-sans-display), sans-serif',
        }}
      >
        {/* Título en itálica, sin filetes ni línea — la referencia "delicada"
            (carta translúcida sobre foto) no usa ningún elemento de línea en
            todo el diseño, la elegancia sale de la tipografía y el espacio
            en blanco solos. Cormorant Garamond itálica (ver app/layout.tsx)
            en vez de recta: mucho más carácter para una frase de 3 palabras
            que una script real habría hecho ilegible a este tamaño. */}
        <span
          style={{
            fontFamily: 'var(--font-serif-display), serif',
            fontStyle: 'italic',
            fontSize: 32, fontWeight: 600, letterSpacing: 0.5,
            color: tokens.headerColor, textAlign: 'center', marginBottom: 26,
          }}
        >
          {titulo}
        </span>

        {/* Nombre en minúscula/oración (no versalita con tracking) y precio
            a un tamaño/peso mucho más parejo con el nombre — la referencia
            no hace que ninguno de los dos "grite" sobre el otro, la
            jerarquía es puramente posicional (izq/der), no tipográfica.
            Sigue sin bordes/divisores entre filas, solo espacio (gap 18). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {servicios.map(servicio => (
            <div
              key={servicio.id}
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}
            >
              <span
                style={{
                  flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 400, letterSpacing: 0.2,
                  color: tokens.nombreColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {servicio.nombre}
              </span>
              <span
                style={{
                  // tokens.precioFontWeight (no un valor fijo): classic/
                  // modern quedan cerca del peso del nombre (600 vs 400,
                  // sutil), bold sigue siendo notoriamente más pesado (800)
                  // — la variación entre estilos se mantiene, solo que
                  // ninguno "grita" tanto como antes (17px -> 13px).
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
            `User.telefono` via useAuthStore, not `Profesional`). Sin línea
            divisoria arriba (antes sí) — consistente con el resto de la
            carta, que ya no usa ningún filete/borde, solo margen (28px,
            era 18+altura de la línea) para separarlo de la lista. */}
        {nombreNegocio && (
          <>
            <span
              style={{
                marginTop: 28, display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1,
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
                    // Peso/tamaño/opacidad subidos (300->500, 8->9, 0.65->0.9)
                    // — quedaba casi ilegible ("muy clarito").
                    fontSize: 9, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase',
                    color: tokens.nombreColor, opacity: 0.9,
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
