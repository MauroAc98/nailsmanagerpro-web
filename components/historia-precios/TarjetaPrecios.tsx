import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Servicio } from '@/services/servicioService';
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

export function TarjetaPrecios({ tokens, servicios, nota, notaAlineacion = 'center', variante = 'flotante', align = 'center', nivelDensidad, onFitChange, reservaInferior = 0, reservaSuperior = 0 }: Props) {
  const t = useTranslations('historia.TarjetaPrecios');
  const esPanel = variante === 'panel';
  const accent   = tokens.claro ? ACCENT_OSCURO    : ACCENT_CLARO;
  const accentBg = tokens.claro ? ACCENT_OSCURO_BG : ACCENT_CLARO_BG;

  // Servicios y promociones combinados en una sola tarjeta (antes eran 2
  // imágenes separadas, ver useHistoriaPrecios). Los sub-headers solo se
  // muestran cuando hay AMBOS grupos — con uno solo (el caso común: un
  // negocio sin promociones cargadas) sería un header redundante repitiendo
  // lo que ya dice el encabezado.
  const serviciosRegulares = servicios.filter(s => !s.es_promo);
  const serviciosPromo     = servicios.filter(s => s.es_promo);
  const mostrarSubheaders  = serviciosRegulares.length > 0 && serviciosPromo.length > 0;

  // Última fila visible de la lista — no lleva línea divisoria: justo abajo
  // ya está el divisor de la nota, y las dos juntas se leían como
  // ruido. Los divisores entre filas quedan; solo se saca el que colgaba al
  // final de la lista.
  const ultimoServicioId = (serviciosPromo.length > 0 ? serviciosPromo : serviciosRegulares).at(-1)?.id;

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
          padding: `${d.cardPaddingY}px 20px`, borderRadius: esPanel ? 12 : 18,
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
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} fuenteNombre={d.fuenteNombre} fuentePrecio={d.fuentePrecio} sinBorde={servicio.id === ultimoServicioId} />
              ))}
            </div>
          )}
          {serviciosPromo.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
              {mostrarSubheaders && <SectionPill texto={t('sectionPromociones')} accent={accent} accentBg={accentBg} />}
              {serviciosPromo.map(servicio => (
                <FilaServicio key={servicio.id} servicio={servicio} tokens={tokens} paddingY={rowPaddingY} fuenteNombre={d.fuenteNombre} fuentePrecio={d.fuentePrecio} sinBorde={servicio.id === ultimoServicioId} />
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
            style={{
              marginTop: d.footerMarginTop, paddingTop: d.footerPaddingTop, borderTop: `1px solid ${tokens.dividerColor}`,
            }}
          >
            {/* Recuadro con el tinte grafito (accentBg, mismo que
                SectionPill) — la nota pasó de letra chica al pie a "leé
                esto": el cliente tiene que verla (seña, retiro aparte,
                etc.). Texto en `accent`, no en nombreColor apagado, para
                que se lea de verdad sin gritar más que la lista de precios. */}
            <div
              style={{
                width: '100%', boxSizing: 'border-box',
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
// `paddingY` llega desde TarjetaPrecios (ver NIVELES_DENSIDAD) — mismo criterio de
// densidad que el resto de la tarjeta, no un valor propio.
function FilaServicio({ servicio, tokens, paddingY, fuenteNombre, fuentePrecio, sinBorde = false }: { servicio: Servicio; tokens: EstiloTokens; paddingY: number; fuenteNombre: number; fuentePrecio: number; sinBorde?: boolean }) {
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
          flex: 1, minWidth: 0, fontSize: fuenteNombre, fontWeight: 400, letterSpacing: 0.2,
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
