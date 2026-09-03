import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
import { EstiloTokens } from './estilos';
import { agendaFontSerif } from '@/theme/agendaColors';
import { nombreMes } from '@/lib/dateFormat';

const formatoPrecio = new Intl.NumberFormat('es-AR');
// Espacio entre "$" y el número (antes pegados) — separa el signo del
// monto como en la referencia, en vez de leerse como un solo token.
const formatearPrecio = (precio: string | null): string =>
  precio ? `$ ${formatoPrecio.format(Number(precio))}` : '-';

interface Props {
  tokens:    EstiloTokens;
  // Card title — fijo, resuelto por el caller (page.tsx) vía
  // tCard('header'). Servicios y promociones se combinan en esta misma
  // tarjeta (ver el split por es_promo más abajo), así que ya no hay un
  // título por modo.
  titulo:    string;
  // Servicios activos del profesional (es_promo:true y es_promo:false
  // mezclados, ver useHistoriaPrecios.serviciosActivos) — TarjetaPrecios no
  // filtra ni lee el store, solo agrupa por es_promo para el render (ver
  // serviciosRegulares/serviciosPromo más abajo).
  servicios: Servicio[];
  // Account/business name (`User.name`, useAuthStore — NOT `Profesional`,
  // a different concept) and phone (`User.telefono`). Threaded down from
  // useHistoriaPrecios through every layer, purely presentational here.
  nombreNegocio: string;
  telefono:      string | null;
  // Name of the professional explicitly picked via the multi-profesional
  // selector (page.tsx) — same precedent as StoryCanvas's `profesionalNombre`
  // (agenda/historia): when set, replaces nombreNegocio in the footer credit
  // so each professional's price story reads as HER card, not the business
  // owner's. undefined (no explicit pick) keeps the existing nombreNegocio-only
  // behavior for single-profesional accounts.
  profesionalNombre?: string;
  // Aclaración breve del negocio (seña, retiro aparte, etc.), escrita en el
  // textarea "Texto adicional" de page.tsx (useHistoriaPrecios.notaAdicional)
  // — se renderiza al pie de la tarjeta, arriba de "Reservá tu turno". Mismo
  // origen que el mock v0 actualizado (price-story.tsx, `footerNote`).
  nota?: string;
  // Alineación del texto de `nota` (mock v0 actualizado: segmented control
  // izquierda/centro/derecha/justificado junto al textarea). 'center' por
  // default — mismo default que el mock.
  notaAlineacion?: 'left' | 'center' | 'right' | 'justify';
  // Chrome de la tarjeta: 'flotante' (default) es la tarjeta redondeada con
  // sombra y borde que usan todas las plantillas salvo `fullbleed`. 'panel'
  // (solo `fullbleed`) achica la sombra/borde. Ambas variantes ocupan el
  // mismo alto (canvas completo) — a diferencia de un diseño anterior que
  // confinaba `panel` a una franja inferior fija, eso se sacó por no
  // alcanzar con listas largas.
  variante?: 'flotante' | 'panel';
  // Anclaje vertical dentro del canvas — 'center' (default, la mayoría de
  // las plantillas), 'start' (tarjeta arriba, deja que la foto respire
  // abajo) o 'end' (tarjeta abajo, foto respira arriba). Nunca cambia la
  // altura disponible, solo dónde se ancla dentro del alto completo.
  align?: 'center' | 'start' | 'end';
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

// Acento fijo para el chrome nuevo de esta tarjeta (barra bajo el título,
// pill de sección, nombre del negocio) — a pedido explícito del usuario: un
// color estandarizado, sin relación con el verde salvia de base de la app
// (theme/colors.ts, primaryRaw '#6b8f6a') ni con tokens.precioColor (que
// varía por plantilla). Se probó dorado antes — rechazado ("tampoco este
// dorado"), pedido explícito: "algo unisex y que no defina una marca".
// Grafito neutro (ni cálido-femenino ni frío-corporativo, sin asociación de
// marca/género).
//
// UN solo valor fijo (sin variante por plantilla) se probó primero y
// rompió el contraste en fullbleed/beforeafter: esas 2 tarjetas son
// oscuras con texto BLANCO en todo lo demás (headerColor/precioColor), y el
// grafito oscuro fijo se leía "muy oscuro"/casi invisible ahí (feedback
// real, con captura). Sigue siendo el MISMO acento conceptual (grafito
// neutro), solo invertido en luminosidad para las 2 plantillas oscuras —
// ver tokens.claro (estilos.ts), no es una variante por mood/marca como
// tokens.precioColor.
const ACCENT_OSCURO    = '#57534E';
const ACCENT_OSCURO_BG = 'rgba(87,83,78,0.14)';
const ACCENT_CLARO     = '#E8E5E1';
const ACCENT_CLARO_BG  = 'rgba(255,255,255,0.14)';

export function TarjetaPrecios({ tokens, titulo, servicios, nombreNegocio, telefono, profesionalNombre, nota, notaAlineacion = 'center', variante = 'flotante', align = 'center' }: Props) {
  const t = useTranslations('historia.TarjetaPrecios');
  const nombreFooter = profesionalNombre || nombreNegocio;
  const esPanel = variante === 'panel';
  const accent   = tokens.claro ? ACCENT_OSCURO    : ACCENT_CLARO;
  const accentBg = tokens.claro ? ACCENT_OSCURO_BG : ACCENT_CLARO_BG;

  // Servicios y promociones combinados en una sola tarjeta (antes eran 2
  // imágenes separadas, ver useHistoriaPrecios). Los sub-headers solo se
  // muestran cuando hay AMBOS grupos — con uno solo (el caso común: un
  // negocio sin promociones cargadas) sería un header redundante repitiendo
  // lo que ya dice `titulo`.
  const serviciosRegulares = servicios.filter(s => !s.es_promo);
  const serviciosPromo     = servicios.filter(s => s.es_promo);
  const mostrarSubheaders  = serviciosRegulares.length > 0 && serviciosPromo.length > 0;

  // Última fila visible de la lista — no lleva línea divisoria: justo abajo
  // ya está el divisor del pie (nota / CTA), y las dos juntas se leían como
  // ruido. Los divisores entre filas quedan; solo se saca el que colgaba al
  // final de la lista.
  const ultimoServicioId = (serviciosPromo.length > 0 ? serviciosPromo : serviciosRegulares).at(-1)?.id;

  // Densidad — la tarjeta ocupa el alto COMPLETO del canvas a propósito (ver
  // comment largo en estilos.ts, 2026-08-18 octava actualización: confinarla
  // a una franja fija ya rompió dos veces con listas reales largas). Pero
  // ese diseño asumía UNA lista (servicios O promociones); combinadas
  // (es_promo unificado, ver useHistoriaPrecios) el total de filas casi se
  // duplica para cualquier negocio con catálogo real, y con el espaciado
  // "normal" la tarjeta terminaba comiéndose casi todo el canvas sin margen
  // — se veía apretada/fea (reportado con captura real: 7 servicios + 4
  // promos). Por debajo del umbral, el espaciado generoso original queda
  // igual; por encima, se compacta (menos gap entre filas/grupos, header más
  // corto) para recuperar el aire alrededor de la tarjeta sin truncar nada.
  const totalItems = servicios.length;
  const compacta    = totalItems > 7;
  const rowGap      = compacta ? 8  : 14;
  const groupGap     = compacta ? 12 : 20;
  const rowPaddingY  = compacta ? 6  : 10;
  const periodoMarginBottom = compacta ? 14 : 24;
  const justifyContent = align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center';
  // "AGOSTO 2026" en el locale activo — mismo criterio editorial que el
  // mock v0 (subtítulo bajo el título, ver captura de referencia), generado
  // al momento de renderizar (no persistido) porque la imagen se comparte
  // fresca cada vez que se genera.
  const ahora = new Date();
  const periodo = `${nombreMes(ahora, 'long', 'mayusculas')} ${ahora.getFullYear()}`;
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        padding: `20px ${OUTER_PADDING_X}px 16px`,
        display: 'flex', flexDirection: 'column', justifyContent,
      }}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          padding: '24px 20px', borderRadius: esPanel ? 12 : 18,
          background: tokens.cardBackground,
          border: `1px solid ${tokens.cardBorder}`,
          // Sombra más sutil (era 4px/16px blur — 5x más difusa que
          // --shadow-card del resto de la app) para leer "carta de precios"
          // en vez de "banner". Ver design review. esPanel (fullbleed): sin
          // sombra — ya lee "tarjeta" por el scrim de fondo, una sombra
          // encima se veía redundante/pesada.
          boxShadow: esPanel ? 'none' : '0 2px 8px rgba(0,0,0,0.10)',
        }}
      >
        {/* Encabezado editorial (ver mock v0, price-story.tsx): eyebrow con
            el nombre de negocio/profesional, título grande alineado a la
            izquierda (ya no centrado) y subtítulo con el período — 3 niveles
            tipográficos en vez del título solo centrado de la versión
            anterior (ver historial git de este archivo). Playfair Display
            recta (agendaFontSerif), no Cormorant Garamond itálica como
            antes — unificación del serif de toda la app a uno solo, ver
            design decision 2026-08-17. */}
        {/* fontSize 9 + opacity 0.65 en tokens.nombreColor original casi no
            se notaba (feedback real: "apenas se nota el nombre del salón") —
            mismo problema que ya resolvimos en SectionPill: texto chico/
            apagado se funde con el fondo. `accent` (no tokens.nombreColor) y
            opacity casi plena para que el nombre del negocio, que es lo
            primero que lee un cliente, realmente resalte. */}
        {nombreFooter && (
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase',
              color: accent, opacity: 0.95, marginBottom: 6,
            }}
          >
            {nombreFooter}
          </span>
        )}
        <span
          style={{
            fontFamily: agendaFontSerif,
            // letterSpacing negativo + lineHeight 1 (mock v0 actualizado,
            // 2026-08-18: tracking-[-0.03em] + leading-none) — serif grande
            // más ajustado/editorial, reemplaza el tracking positivo suelto
            // de la versión anterior.
            fontSize: 31, fontWeight: 400, letterSpacing: -0.9, lineHeight: 1,
            color: tokens.headerColor, textAlign: 'left',
          }}
        >
          {titulo}
        </span>
        {/* Barra de acento bajo el título — referencia visual real que mandó
            el usuario (ejemplo.png). `accent` (ver comment arriba), no
            tokens.precioColor: probado antes, en la mayoría de plantillas es
            negro/blanco puro y no se leía como "color" real. */}
        <div style={{ width: 32, height: 3, borderRadius: 2, background: accent, marginTop: 10 }} />
        <span
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
            color: tokens.nombreColor, opacity: 0.65, marginTop: 8, marginBottom: periodoMarginBottom,
          }}
        >
          {periodo}
        </span>

        {/* Nombre en minúscula/oración (no versalita con tracking) y precio
            a un tamaño/peso mucho más parejo con el nombre — la referencia
            no hace que ninguno de los dos "grite" sobre el otro, la
            jerarquía es puramente posicional (izq/der), no tipográfica.
            Línea divisoria bajo cada fila (tokens.dividerColor, ver mock v0)
            — reemplaza el espaciado puro sin bordes de la versión anterior. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: groupGap }}>
          {serviciosRegulares.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
              {mostrarSubheaders && <SectionPill texto={t('sectionServicios')} accent={accent} accentBg={accentBg} />}
              {serviciosRegulares.map(servicio => (
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} sinBorde={servicio.id === ultimoServicioId} />
              ))}
            </div>
          )}
          {serviciosPromo.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
              {mostrarSubheaders && <SectionPill texto={t('sectionPromociones')} accent={accent} accentBg={accentBg} />}
              {serviciosPromo.map(servicio => (
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} sinBorde={servicio.id === ultimoServicioId} />
              ))}
            </div>
          )}
        </div>

        {/* Pie de tarjeta — nota adicional (aclaración libre, ver prop
            `nota`) y/o CTA reservar+teléfono, separados de la lista de
            precios por un divisor. El nombre ya se muestra arriba como
            eyebrow (ver encabezado editorial), así que este bloque no lo
            repite. CTA: mismo lenguaje visual que el footer de StoryCanvas
            (label mayúscula wide-tracked + fila de ícono/teléfono),
            adaptado a los tokens por plantilla en vez de blanco
            hardcodeado: la tarjeta opaca clara necesita texto oscuro. See
            StoryCanvas.tsx lines ~238-257 for the reference. */}
        {(nota || (nombreFooter && telefono)) && (
          <div
            style={{
              marginTop: 20, paddingTop: 14, borderTop: `1px solid ${tokens.dividerColor}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            {nota && (
              // Recuadro con el tinte grafito (accentBg, mismo que
              // SectionPill) — la nota pasó de letra chica al pie a "leé
              // esto": el cliente tiene que verla (seña, retiro aparte,
              // etc.). Texto en `accent`, no en nombreColor apagado, para
              // que se lea de verdad sin gritar más que la lista de precios.
              <div
                style={{
                  width: '100%', boxSizing: 'border-box', margin: '0 0 10px',
                  backgroundColor: accentBg, borderRadius: 10, padding: '8px 12px',
                }}
              >
                <p
                  style={{
                    margin: 0, whiteSpace: 'pre-line', textAlign: notaAlineacion,
                    fontSize: 9, fontWeight: 400, lineHeight: 1.55, color: accent,
                  }}
                >
                  {nota}
                </p>
              </div>
            )}
            {nombreFooter && telefono && (
              <>
                <span
                  style={{
                    // Serif itálica (mock v0 actualizado: font-serif italic,
                    // sin mayúsculas ni tracking) — reemplaza la versalita
                    // wide-tracked anterior, que copiaba el lenguaje del
                    // footer de StoryCanvas en vez del de esta tarjeta.
                    fontFamily: agendaFontSerif, fontStyle: 'italic',
                    fontSize: 12, fontWeight: 400,
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// SectionPill — header de sección ("SERVICIOS"/"PROMOCIONES"): label en
// negrita dentro de un pill + regla horizontal que llena el resto del ancho.
// Reemplaza el span de 9px/opacidad 0.55 de antes, que se fundía con el
// fondo (feedback real: "no resaltan los subtítulos/categorías"). Sin ícono
// — versión anterior lo tenía (mano/regalo), feedback real: "no me convence,
// quitarlos". `accent`/`accentBg` llegan resueltos desde TarjetaPrecios (ya
// eligió la variante clara/oscura según tokens.claro) — este componente no
// decide el color, solo lo aplica.
function SectionPill({ texto, accent, accentBg }: { texto: string; accent: string; accentBg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ backgroundColor: accentBg, borderRadius: 999, padding: '5px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: accent }}>
          {texto}
        </span>
      </div>
      <div style={{ flex: 1, height: 1, backgroundColor: accentBg }} />
    </div>
  );
}

// Fila individual — extraída para no duplicar el markup entre el grupo de
// servicios y el de promociones (ver split por es_promo en TarjetaPrecios).
// `paddingY` llega desde TarjetaPrecios (ver `compacta`) — mismo criterio de
// densidad que el resto de la tarjeta, no un valor propio.
function FilaServicio({ servicio, tokens, paddingY, sinBorde = false }: { servicio: Servicio; tokens: EstiloTokens; paddingY: number; sinBorde?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
        paddingBottom: sinBorde ? 0 : paddingY,
        borderBottom: sinBorde ? undefined : `1px solid ${tokens.dividerColor}`,
      }}
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
          // tokens.precioFontWeight (no un valor fijo): varía por plantilla
          // (ver estilos.ts) — la variación entre estilos se mantiene, solo
          // que ninguno "grita" tanto como antes (17px -> 13px).
          fontSize: 13, fontWeight: tokens.precioFontWeight, color: tokens.precioColor,
          letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {formatearPrecio(servicio.precio)}
      </span>
    </div>
  );
}
