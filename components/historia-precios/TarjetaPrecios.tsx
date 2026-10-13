import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
import { agendaFontSerif } from '@/theme/agendaColors';
import { EstiloTokens } from './estilos';
import { formatoPrecioTarjeta } from '@/lib/formatoPrecioTarjeta';
import { NIVELES_DENSIDAD, elegirDensidad, type DensidadTokens, type ResultadoDensidad } from '@/lib/historiaDensidad';

interface Props {
  tokens:    EstiloTokens;
  // Servicios activos del profesional (es_promo:true y es_promo:false
  // mezclados, ver useHistoriaPrecios.serviciosActivos) — TarjetaPrecios no
  // filtra ni lee el store, solo agrupa por es_promo para el render (ver
  // serviciosRegulares/serviciosPromo más abajo).
  servicios: Servicio[];
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
  // Ajuste al contenido. Por defecto la tarjeta MIDE su contenido real y baja
  // de densidad (ver NIVELES_DENSIDAD) hasta que entra en el alto del canvas;
  // reporta el resultado con `onFitChange` (debe ser estable). Si se pasa
  // `nivelDensidad` (miniaturas del picker) NO mide: usa ese nivel tal cual.
  nivelDensidad?: number;
  onFitChange?:   (resultado: ResultadoDensidad) => void;
  // Alto (px) que el canvas reserva abajo para el pie de contacto, que se
  // dibuja sobre la foto fuera de la tarjeta. El contenedor termina ese alto
  // antes del borde inferior, así el `clientHeight` que mide el ajuste ya
  // descuenta el pie y la tarjeta nunca lo pisa.
  reservaInferior?: number;
  // Alto (px) que el canvas reserva ARRIBA para el encabezado, que se dibuja
  // sobre la foto fuera de la tarjeta (ver reservaSuperiorEncabezado). Igual que
  // reservaInferior: el contenedor empieza ese alto debajo del borde superior,
  // así lo que mide el ajuste ya lo descuenta y la tarjeta nunca pisa el encabezado.
  reservaSuperior?: number;
}

// Padding vertical del contenedor absoluto (20 arriba + 16 abajo): el alto
// disponible para la tarjeta es el del contenedor menos esto.
const PADDING_TOP = 20;
const PADDING_BOTTOM = 16;

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
// Ahora la tarjeta arranca en el mismo eje que el encabezado y el pie (18px):
// con el header y el pie alineados a la izquierda, una tarjeta metida 54px
// quedaba corrida (rediseño editorial 2026-10-13).
const OUTER_PADDING_X = 18;

// Tamaños de la carta por nivel de densidad: el nombre va en serif (más grande
// que el sans de antes a igual legibilidad) y el precio en sans. Bajan con la
// densidad, pero nunca del piso de 12px de NIVELES_DENSIDAD.
const FUENTE_NOMBRE_CARTA = [16, 15.5, 14, 13];
const FUENTE_PRECIO_CARTA = [15, 14.5, 13.5, 13];
// Subtítulos "Servicios"/"Promociones": siempre más grandes que el nombre de una
// fila para que se lean como encabezado de sección, y bajan con la densidad.
const FUENTE_SUBTITULO_CARTA = [26, 25, 22, 20];
// Color pleno de los subtítulos (tinta oscura en las plantillas claras, blanco
// en las oscuras): los nombres de las filas usan tokens.nombreColor (~75%).
const SUBTITULO_OSCURO = '#2B2226';
const SUBTITULO_CLARO  = '#FFFFFF';

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
const ACCENT_CLARO     = '#E8E5E1';

export function TarjetaPrecios({ tokens, servicios, nota, notaAlineacion = 'center', variante = 'flotante', align = 'center', nivelDensidad, onFitChange, reservaInferior = 0, reservaSuperior = 0 }: Props) {
  const t = useTranslations('historia.TarjetaPrecios');
  const esPanel = variante === 'panel';
  const accent   = tokens.claro ? ACCENT_OSCURO    : ACCENT_CLARO;

  // Servicios y promociones combinados en una sola tarjeta (antes eran 2
  // imágenes separadas, ver useHistoriaPrecios). Los sub-headers solo se
  // muestran cuando hay AMBOS grupos — con uno solo (el caso común: un
  // negocio sin promociones cargadas) sería un header redundante repitiendo
  // lo que ya dice el encabezado.
  const serviciosRegulares = servicios.filter(s => !s.es_promo);
  const serviciosPromo     = servicios.filter(s => s.es_promo);
  const mostrarSubheaders  = serviciosRegulares.length > 0 && serviciosPromo.length > 0;

  // Densidad — la tarjeta ocupa el alto COMPLETO del canvas a propósito (ver
  // estilos.ts, 2026-08-18 octava actualización). El canvas es fijo, así que
  // lo que se adapta es el contenido: se MIDE el alto natural real de la
  // tarjeta (filas y nota incluidas, lo que sea que renderice) en cada nivel de NIVELES_DENSIDAD, del más cómodo al más
  // compacto, y se queda con el primero que entra. Si ni el último entra,
  // reporta entra=false en vez de recortar en silencio. Todo ocurre en
  // useLayoutEffect: los re-renders de cada paso se resuelven de forma
  // síncrona antes del primer paint, así que cuando html-to-image captura el
  // nivel ya está asentado.
  const medir = nivelDensidad === undefined;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const cardRef       = useRef<HTMLDivElement>(null);
  const alturasRef    = useRef<number[]>([]);
  const onFitRef      = useRef(onFitChange);
  onFitRef.current = onFitChange;

  // Re-medir también cuando termina de cargar la tipografía (cambia el alto).
  const [fuentesListas, setFuentesListas] = useState(false);
  useEffect(() => {
    if (!medir) return;
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fonts?.ready) return;
    let activo = true;
    fonts.ready.then(() => { if (activo) setFuentesListas(true); });
    return () => { activo = false; };
  }, [medir]);

  const firma = JSON.stringify([
    servicios.map(s => [s.id, s.nombre, s.precio, s.es_promo]),
    nota ?? '', reservaInferior, reservaSuperior, variante, fuentesListas,
  ]);
  const [medicion, setMedicion] = useState({ firma, nivel: 0, fin: false });
  let estado = medicion;
  if (medir && medicion.firma !== firma) {
    // Contenido nuevo: arrancar de cero desde el nivel más cómodo.
    estado = { firma, nivel: 0, fin: false };
    setMedicion(estado);
  }

  useLayoutEffect(() => {
    if (!medir || medicion.fin || medicion.firma !== firma) return;
    const card = cardRef.current;
    const contenedor = contenedorRef.current;
    if (!card || !contenedor) return;
    if (medicion.nivel === 0) alturasRef.current = [];
    alturasRef.current[medicion.nivel] = card.offsetHeight;
    const disponible = contenedor.clientHeight - PADDING_TOP - PADDING_BOTTOM;
    const r = elegirDensidad(alturasRef.current, disponible);
    if (r.entra || medicion.nivel >= NIVELES_DENSIDAD.length - 1) {
      setMedicion({ firma: medicion.firma, nivel: r.nivel, fin: true });
      onFitRef.current?.(r);
    } else {
      setMedicion({ firma: medicion.firma, nivel: medicion.nivel + 1, fin: false });
    }
  }, [medir, medicion, firma]);

  const nivel = Math.min(
    Math.max(medir ? estado.nivel : nivelDensidad, 0),
    NIVELES_DENSIDAD.length - 1,
  );
  const d: DensidadTokens = NIVELES_DENSIDAD[nivel];
  const { rowGap, groupGap, rowPaddingY } = d;
  const fuenteNombre = FUENTE_NOMBRE_CARTA[nivel];
  const fuentePrecio = FUENTE_PRECIO_CARTA[nivel];
  const fuenteSubtitulo = FUENTE_SUBTITULO_CARTA[nivel];
  const colorSubtitulo  = tokens.claro ? SUBTITULO_OSCURO : SUBTITULO_CLARO;
  const justifyContent = align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center';
  return (
    <div
      ref={contenedorRef}
      data-testid="tarjeta-contenedor"
      style={{
        position: 'absolute', inset: 0, top: reservaSuperior, bottom: reservaInferior,
        padding: `${PADDING_TOP}px ${OUTER_PADDING_X}px ${PADDING_BOTTOM}px`,
        display: 'flex', flexDirection: 'column', justifyContent,
      }}
    >
      <div
        ref={cardRef}
        data-testid="tarjeta-card"
        data-densidad={nivel}
        style={{
          display: 'flex', flexDirection: 'column',
          padding: `${d.cardPaddingY}px 24px`, borderRadius: esPanel ? 12 : 20,
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
        {/* Estilo "carta": nombre en serif a la izquierda, una línea de
            puntos (la misma de la lista de días de la historia de turnos) y el
            precio en sans a la derecha. Sin línea divisoria por fila: la guía
            de puntos ya une cada nombre con su precio. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: groupGap }}>
          {serviciosRegulares.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
              {mostrarSubheaders && <SectionLabel texto={t('sectionServicios')} accent={colorSubtitulo} fuente={fuenteSubtitulo} />}
              {serviciosRegulares.map(servicio => (
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} fuenteNombre={fuenteNombre} fuentePrecio={fuentePrecio} />
              ))}
            </div>
          )}
          {serviciosPromo.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
              {mostrarSubheaders && <SectionLabel texto={t('sectionPromociones')} accent={colorSubtitulo} fuente={fuenteSubtitulo} />}
              {serviciosPromo.map(servicio => (
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} fuenteNombre={fuenteNombre} fuentePrecio={fuentePrecio} />
              ))}
            </div>
          )}
        </div>

        {/* Pie de tarjeta — nota adicional (aclaración libre, ver prop
            `nota`), separada de la lista de precios por un divisor. El CTA
            "Reservá tu turno" y el contacto ya no van acá: los dibuja
            HistoriaPreciosCanvas sobre la foto con PieContacto, igual que la
            historia de turnos. */}
        {nota && (
          <div
            data-testid="tarjeta-nota"
            style={{
              marginTop: d.footerMarginTop, paddingTop: d.footerPaddingTop,
              // Hilo fino con degradado (nace en el borde izquierdo, como el
              // del encabezado y el pie) en vez de una línea plana.
              backgroundImage: `linear-gradient(90deg, ${tokens.dividerColor}, rgba(0,0,0,0))`,
              backgroundSize: '100% 1px', backgroundRepeat: 'no-repeat', backgroundPosition: 'top',
            }}
          >
            {/* La nota (seña, retiro aparte, etc.) va en serif cursiva, con la
                voz de la marca, en vez del recuadro tintado de antes. Texto en
                `accent`, no en nombreColor apagado, para que se lea de verdad
                sin gritar más que la lista de precios. */}
            <p
              style={{
                margin: 0, whiteSpace: 'pre-line', textAlign: notaAlineacion,
                fontFamily: agendaFontSerif, fontStyle: 'italic', fontSize: 11.5, fontWeight: 400,
                lineHeight: 1.5, color: accent,
              }}
            >
              {nota}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// SectionLabel — subtítulo de sección ("Servicios"/"Promociones"): una palabra en
// serif cursiva, con la misma voz que el título del encabezado, + un hilo que
// nace pegado a la palabra y se desvanece hacia la derecha (el mismo degradado
// de las líneas del encabezado y el pie). Sin ícono — versión anterior lo tenía
// (mano/regalo), feedback real: "no me convence, quitarlos". `accent` llega
// resuelto desde TarjetaPrecios (ya eligió la variante clara/oscura según
// tokens.claro) — este componente no decide el color, solo lo aplica.
function SectionLabel({ texto, accent, fuente }: { texto: string; accent: string; fuente: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      {/* Color pleno (los nombres de las filas van al 75%) y peso 500: el
          subtítulo tiene que mandar sobre los servicios, no igualarlos. */}
      <span
        data-testid="tarjeta-subtitulo"
        style={{
          fontFamily: agendaFontSerif, fontStyle: 'italic', fontWeight: 500, fontSize: fuente,
          lineHeight: 1, letterSpacing: '-0.02em', color: accent,
        }}
      >
        {texto}
      </span>
      {/* En baseline el borde inferior de un hueco cae sobre la línea base:
          se sube unos px para que el hilo quede a media altura de la palabra. */}
      <div
        aria-hidden
        style={{
          flex: 1, height: 1, opacity: 0.4, transform: 'translateY(-4px)',
          background: `linear-gradient(90deg, ${accent}, rgba(0,0,0,0))`,
        }}
      />
    </div>
  );
}

// Fila individual — extraída para no duplicar el markup entre el grupo de
// servicios y el de promociones (ver split por es_promo en TarjetaPrecios).
// `paddingY` llega desde TarjetaPrecios (ver NIVELES_DENSIDAD) — mismo criterio de
// densidad que el resto de la tarjeta, no un valor propio.
function FilaServicio({ servicio, tokens, paddingY, fuenteNombre, fuentePrecio }: { servicio: Servicio; tokens: EstiloTokens; paddingY: number; fuenteNombre: number; fuentePrecio: number }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'baseline', paddingBottom: paddingY,
      }}
    >
      <span
        style={{
          flex: '0 1 auto', minWidth: 0, fontFamily: agendaFontSerif, fontSize: fuenteNombre, fontWeight: 400,
          letterSpacing: '-0.01em', lineHeight: 1.15,
          color: tokens.nombreColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {servicio.nombre}
      </span>
      {/* Guía de puntos: ocupa lo que sobra entre el nombre y el precio. Con
          baseline, el borde inferior de un hueco cae sobre la línea base del
          texto; se sube unos px para que quede a media altura de las
          minúsculas. Opacidad aparte para no teñir también el texto. */}
      <span
        aria-hidden
        data-testid="tarjeta-guia"
        style={{
          flex: 1, minWidth: 14, margin: '0 10px', opacity: 0.4,
          borderBottom: `1px dotted ${tokens.nombreColor}`, transform: 'translateY(-4px)',
        }}
      />
      <span
        style={{
          // tokens.precioFontWeight (no un valor fijo): varía por plantilla
          // (ver estilos.ts) — la variación entre estilos se mantiene, solo
          // que ninguno "grita" tanto como antes (17px -> 13px).
          fontSize: fuentePrecio, fontWeight: tokens.precioFontWeight, color: tokens.precioColor,
          letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {formatoPrecioTarjeta(servicio.precio)}
      </span>
    </div>
  );
}
