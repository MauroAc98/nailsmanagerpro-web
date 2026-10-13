'use client';

import { forwardRef, Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DisponibilidadDia } from '@/services/turnoService';
import { TextoLibre } from '@/hooks/useGenerarHistoria';
import { TextoDraggable } from '@/components/historia/TextoDraggable';
import { agendaFontSerif } from '@/theme/agendaColors';
import { PieContacto } from '@/components/historia/PieContacto';
import { FitText } from '@/components/historia/FitText';
import { nombreDia as nombreDiaIntl, nombreMes as nombreMesIntl } from '@/lib/dateFormat';
import { safeAreaInsets } from '@/lib/historia/safeArea';
import { zonaPieDesdeLinea } from '@/lib/historia/zonaPie';
import { MAX_LINEAS_SERVICIOS, TAMANO_LINEA_SERVICIOS, medirTextoServicios, repartirEnRenglones } from '@/lib/historiaServicios';

// Misma pila que el resto de la app (globals.css): la fila de horas va en serif
// y los números vuelven a esta fuente para leerse parejos.
const FUENTE_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function partesDia(fecha: string): { abrev: string; numero: number } {
  const d = new Date(fecha + 'T00:00:00');
  // Intl da la abreviatura de es-* con punto final ("jue.", "mié.") — se
  // saca acá para que en la imagen quede "JUE 3", no "JUE. 3".
  return { abrev: nombreDiaIntl(d, 'short', 'mayusculas').replace(/\.+$/, ''), numero: d.getDate() };
}

// ["10hs", "14hs"] -> números sueltos + "hs" una sola vez al final ("10 · 14 hs"),
// así no se repite la unidad en cada hora. Si alguna hora tiene otro formato,
// se muestran todas tal cual.
function partirHoras(horas: string[]): { numeros: string[]; unidad: string | null } {
  const partes = horas.map(h => /^(\d{1,2}(?::\d{2})?)\s*(hs)$/i.exec(h.trim()));
  if (partes.length === 0 || !partes.every(Boolean)) return { numeros: horas, unidad: null };
  return { numeros: partes.map(m => m![1]), unidad: partes[0]![2] };
}

// Punto medio entre horas, tenue para que mande el número.
function SeparadorHoras() {
  return (
    <span data-testid="story-separador-hora" aria-hidden style={{ opacity: 0.55, margin: '0 0.45em', fontStyle: 'italic' }}>·</span>
  );
}

interface Props {
  titulo:         string;
  // Nombre del estudio (User.name / "Nombre del estudio" en perfil) — línea
  // de marca del header. Pedido de vuelta por feedback de clientes
  // (2026-08-17): les gustaba ver el nombre ahí.
  nombreEstudio?: string | null;
  // Teléfono del estudio (User.telefono, mismo dato que Perfil → Datos
  // personales) — se muestra en el footer para que quien vea la historia
  // compartida sepa por dónde contactar, sin tener que buscarlo aparte.
  telefonoEstudio?: string | null;
  // Multi-agenda — nombre de la profesional cuya disponibilidad se muestra.
  // Si viene (elegida a mano), el header pasa a "Turnos disponibles" y una
  // línea "con {nombre} · {fecha}" (ver lineaProfesional); el nombre del
  // negocio baja al pie.
  profesionalNombre?: string;
  // Encabezado A2. Con servicios elegidos (servicios.length > 0) el header
  // pasa a: kicker "TURNOS DISPONIBLES · FECHA", titular (`titulo`: la
  // categoría o categorías) + "con {profesional}", y debajo una línea con los
  // nombres de los servicios (máx. 2 líneas). Sin esto, el diseño de siempre.
  filtroServicios?: { titulo: string; servicios: string[] };
  // Foto/logo del negocio (User.logo_url) — reemplaza al chip de fecha /
  // ícono genérico en el header, en los 3 modos (día/semana/mes), para
  // impulsar la marca del negocio en la imagen que se comparte (pedido
  // 2026-09-30: "que se vea el perfil en el lugar donde se ve el ícono de
  // agenda... o el ícono dinámico, según sea el caso"). Sin logo cargado,
  // el header se ve igual que siempre (chip/ícono) — no hay foto que
  // inventar. Un badge de fecha superpuesto no escala a semana/mes (no
  // entra un rango o un mes en una etiqueta chica), así que la fecha/rango
  // sigue viviendo solo en el texto de abajo, con o sin logo.
  logoUrl?: string | null;
  dias:           DisponibilidadDia[]; // diasAMostrar
  fondoUri:       string | null;
  canvasWidth:    number;
  canvasHeight:   number;
  textosLibres:   TextoLibre[];
  onMoverTexto:   (id: string, x: number, y: number) => void;
  onResizeTexto:  (id: string, fontSize: number) => void;
  onEditarTexto:  (id: string) => void;
  // Escala con la que se muestra en pantalla (la historia se dibuja a tamaño
  // fijo, ver lib/historia/formatoHistoria): solo la usa el arrastre de textos.
  escala?:        number;
}

// ─────────────────────────────────────────────
// StoryCanvas — DOM-rendered shareable "story" preview.
// forwardRef exposes the outer node for html-to-image capture.
// ─────────────────────────────────────────────
export const StoryCanvas = forwardRef<HTMLDivElement, Props>(function StoryCanvas(
  { titulo, nombreEstudio, telefonoEstudio, profesionalNombre, filtroServicios, logoUrl, dias, fondoUri, canvasWidth, canvasHeight, textosLibres, onMoverTexto, onResizeTexto, onEditarTexto, escala = 1 },
  ref
) {
  const t = useTranslations('historia.StoryCanvas');
  const esModoDia = dias.length === 1;

  // Chip de fecha en el header — el número de día solo tiene sentido en modo
  // Día (una fecha puntual). En Semana/Mes no hay "un" día que mostrar ahí:
  // inventar uno (el primero del rango, por ejemplo) sugeriría que solo ese
  // día tiene turnos. Ahí el chip muestra mes y año del primer día, que es
  // verdad para un mes o una quincena (una semana que cruza de mes muestra el
  // mes en que arranca).
  const fechaChip     = esModoDia && dias[0] ? new Date(dias[0].fecha + 'T00:00:00') : null;
  const chipDiaLabel  = fechaChip ? nombreDiaIntl(fechaChip, 'short', 'mayusculas') : null;
  const chipDiaNumero = fechaChip ? fechaChip.getDate() : null;
  const fechaInicio   = dias[0] ? new Date(dias[0].fecha + 'T00:00:00') : null;
  // Intl da la abreviatura con punto final ("oct.") — se saca como en nombreDia.
  const chipMes  = fechaInicio ? nombreMesIntl(fechaInicio, 'short', 'primera').replace(/\.+$/, '') : '';
  const chipAnio = fechaInicio ? String(fechaInicio.getFullYear()) : '';

  // Un único diseño para todas las cuentas: arriba una etiqueta chica
  // "{fecha} — con {profesional}" (solo la fecha si no hay profesional) y
  // debajo el título "Turnos disponibles", con la palabra clave en cursiva.
  // El nombre del negocio va siempre en el pie, junto al teléfono.
  const enNegrita = (chunks: ReactNode) => <b style={{ color: '#fff', fontWeight: 700 }}>{chunks}</b>;
  const enCursiva = (chunks: ReactNode) => <em style={{ fontStyle: 'italic' }}>{chunks}</em>;

  // Safe area — Instagram/WhatsApp tapan el borde superior e inferior de la
  // historia con su propio chrome y, en celus más altos que 9:16, recortan
  // la imagen al "llenar". El contenido (header, lista, footer) se mete
  // dentro de estos márgenes; la foto de fondo sigue full-bleed (ver
  // lib/historia/safeArea.ts).
  const safe = safeAreaInsets(canvasHeight);

  // Alto realmente disponible para el contenido, ya descontada la safe area
  // — antes era un 0.75 fijo que no reflejaba el chrome de las plataformas.
  const alturaUtil = Math.max(0, canvasHeight - safe.top - safe.bottom);
  const gap        = Math.max(4, Math.min(20, (alturaUtil - dias.length * 20) / (dias.length + 1)));

  // Zonas de blur local detrás de título y footer — alto aproximado, no
  // medido en vivo. Header vuelve a tener chip+nombre+caption+fecha (pedido
  // de vuelta por feedback de clientes 2026-08-17: "les gustó"), así que la
  // zona de blur creció con él respecto a la versión de solo dos líneas.
  // Ahora arrancan/terminan en el borde del canvas pero llegan hasta pasado
  // el header/footer ya corridos hacia adentro por la safe area — el blur
  // extra cae detrás del chrome de la plataforma, así que no se ve de más.
  const tituloZonaAlto = safe.top    + Math.round(canvasHeight * 0.10);
  const footerZonaAlto = safe.bottom + Math.round(canvasHeight * 0.10);

  // La franja desenfocada del pie tiene que arrancar justo en la línea
  // divisoria, y esa línea se mueve con el contenido (alto del pie, cuerpo,
  // tamaño del canvas): se mide en vez de usar un alto fijo. footerZonaAlto
  // queda solo como valor inicial / sin layout (tests, primer render).
  const raizRef   = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const lineaRef  = useRef<HTMLDivElement>(null);
  const pieRef    = useRef<HTMLDivElement>(null);
  const [zonaPieMedida, setZonaPieMedida] = useState<number | null>(null);
  useEffect(() => {
    const raiz = raizRef.current;
    const linea = lineaRef.current;
    if (!raiz || !linea || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const r = raiz.getBoundingClientRect();
      const l = linea.getBoundingClientRect();
      const alto = zonaPieDesdeLinea({
        bottomRaiz: r.bottom, topLinea: l.top, alturaRenderizada: r.height, alturaCanvas: canvasHeight,
      });
      setZonaPieMedida(prev => (alto === null || prev === alto ? prev : alto));
    };
    // Observar el canvas, el cuerpo y el pie: si cualquiera cambia de alto, la
    // línea cambia de lugar. ResizeObserver avisa también al empezar a observar.
    const ro = new ResizeObserver(medir);
    [raiz, cuerpoRef.current, pieRef.current].forEach(el => { if (el) ro.observe(el); });
    return () => ro.disconnect();
  }, [canvasHeight, canvasWidth]);
  const zonaPie = zonaPieMedida ?? footerZonaAlto;

  // La foto de fondo se sube un poco. La barra de responder/enviar de
  // Instagram y WhatsApp tapa más abajo (safe.bottom) que la barra de
  // perfil arriba (safe.top), así que el centro de lo que el que mira
  // realmente ve queda por encima del centro geométrico del canvas. Se
  // sobredimensiona la imagen (fondoAlto) y se la corre hacia arriba
  // (fondoTop): con este shift el punto medio de la foto queda ubicado
  // justo en ese centro visual (safe.top + (canvasHeight - safe.top -
  // safe.bottom) / 2). Mismos valores en las 2 copias con blur para que
  // sigan alineadas al píxel con la foto base.
  const fondoShift = safe.bottom - safe.top;
  const fondoTop   = -fondoShift;
  const fondoAlto  = canvasHeight + fondoShift;

  // Separación entre el header y la primera fila de horarios — proporcional
  // al canvas, no un 14px fijo que quedaba pegado al degradado del header
  // (que llega hasta tituloZonaAlto). Abajo del body alcanza con poco: el
  // divisor + footer ya tienen su propio margen.
  // Con servicios elegidos (M1, canvas 2026-10-12): el título nombra la
  // categoría ("Turnos de Faciales") y, debajo del encabezado, los servicios
  // van como bajada en mayúsculas chicas con espaciado (hasta 2 renglones). En
  // quincena el alto que suma la bajada lo devuelven el margen y los espacios
  // entre filas, así el total queda igual que en producción.
  const servicios = filtroServicios?.servicios ?? [];
  const conServicios = servicios.length > 0;
  const ALTO_RENGLON_SERVICIOS = 14;
  const SEPARACION_BAJADA = 10;
  const MARGEN_CON_SERVICIOS = 18;
  // Mismos renglones que mide el aviso de la hoja: el "·" solo va entre
  // servicios del mismo renglón, nunca al principio ni al final de uno.
  const renglonesServicios = conServicios
    ? repartirEnRenglones(servicios, canvasWidth - 36, medirTextoServicios).slice(0, MAX_LINEAS_SERVICIOS)
    : [];
  const lineasServicios = renglonesServicios.length;
  const altoFranja = conServicios ? SEPARACION_BAJADA + lineasServicios * ALTO_RENGLON_SERVICIOS : 0;
  const bodyMargenBase = Math.round(canvasHeight * 0.06);
  const margenEncabezadoLista = conServicios ? MARGEN_CON_SERVICIOS : bodyMargenBase;
  const altoADevolver = Math.max(0, altoFranja + margenEncabezadoLista - bodyMargenBase);

  // Línea fina entre el encabezado y la lista, igual que la del pie. El
  // encabezado sube SUBIDA_ENCABEZADO px y ese espacio se suma al margen: la
  // lista queda donde estaba y la línea cabe adentro del margen, centrada.
  // Sube poco a propósito: la zona segura de arriba es lo que tapa la barra
  // de perfil de Instagram/WhatsApp.
  const SUBIDA_ENCABEZADO = 4;
  const espacioEncabezadoLista = margenEncabezadoLista + SUBIDA_ENCABEZADO;
  const aireArribaLinea = Math.round((espacioEncabezadoLista - 1) / 2);
  const aireAbajoLinea  = espacioEncabezadoLista - 1 - aireArribaLinea;
  const gapLista = dias.length > 1 ? Math.max(2, gap - altoADevolver / (dias.length - 1)) : gap;

  // La franja desenfocada del encabezado cubre la insignia (44px); con
  // servicios se estira hasta cubrir también la bajada.
  const franjaEncabezado = tituloZonaAlto
    + Math.max(0, 44 + altoFranja - Math.round(canvasHeight * 0.10));

  // Con logo cargado, la foto del negocio (o de la profesional) ocupa este
  // mismo círculo en los 3 modos — decisión 2026-09-30 tras canvas de diseño:
  // un badge de fecha superpuesto no escala a semana/mes. Sin foto: la fecha
  // en modo Día y mes + año en Semana/Mes, en un círculo de vidrio. El anillo
  // es un box-shadow (no un `filter` en vivo: html-to-image rasteriza como SVG
  // foreignObject y WebKit combina mal ese filtro — la historia entera salía
  // negra en Safari, real en prod 2026-10-01).
  const ANILLO_INSIGNIA = '0 0 0 1.5px rgba(255,255,255,0.85), 0 0 0 4.5px rgba(255,255,255,0.22)';
  const insignia = logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      style={{
        flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
        objectFit: 'cover', boxShadow: ANILLO_INSIGNIA,
      }}
    />
  ) : (
    <span style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, width: 44, height: 44, borderRadius: '50%', boxShadow: ANILLO_INSIGNIA,
      background: 'linear-gradient(160deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))', color: '#fff',
    }}>
      {chipDiaNumero !== null ? (
        <>
          <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', paddingLeft: '0.18em', textTransform: 'uppercase', opacity: 0.85 }}>
            {chipDiaLabel}
          </span>
          <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 21, lineHeight: 1, marginTop: 1 }}>
            {chipDiaNumero}
          </span>
        </>
      ) : (
        <>
          <span style={{ fontFamily: agendaFontSerif, fontStyle: 'italic', fontWeight: 400, fontSize: 17, lineHeight: 1 }}>
            {chipMes}
          </span>
          <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.2em', paddingLeft: '0.2em', opacity: 0.8, marginTop: 3 }}>
            {chipAnio}
          </span>
        </>
      )}
    </span>
  );

  return (
    // Wrapper solo para el look on-screen (esquinas redondeadas). El nodo
    // capturado por html-to-image es el de más adentro (el que tiene `ref`)
    // y NO tiene borderRadius propio — si lo tuviera, quedaría horneado en
    // el PNG exportado como esquinas transparentes/negras. Instagram y
    // WhatsApp Status muestran la imagen full-bleed, así que un PNG con
    // esquinas redondeadas se ve como si no llenara el recuadro (era un
    // solo bug con dos síntomas, no dos bugs distintos).
    <div ref={raizRef} data-testid="story-raiz" style={{ width: canvasWidth, height: canvasHeight, margin: '0 auto', borderRadius: 16, overflow: 'hidden' }}>
      <div
        ref={ref}
        style={{
          width:    '100%',
          height:   '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image — corrida hacia arriba (fondoTop/fondoAlto) para
            centrarla en el área visible real de la historia, no en el
            canvas entero (ver comentario en fondoShift). */}
        <img
          src={fondoUri ?? '/default_bg.jpg'}
          alt=""
          style={{
            position: 'absolute', left: 0,
            top: fondoTop, width: '100%', height: fondoAlto,
            objectFit: 'cover',
          }}
        />

        {/* Blur local detrás de título y footer — el texto arriba/abajo
            queda nítido, solo el fondo en esas dos franjas se ve fuera de
            foco para llevar la atención ahí, sin blurear toda la foto.
            filter:blur() sobre una segunda copia de la misma imagen (no
            backdrop-filter): es un filtro real sobre contenido rasterizado,
            así que sí sobrevive la captura de html-to-image — backdrop-
            filter no compone de forma confiable en su pipeline SVG
            foreignObject. Cada copia se renderiza a canvasHeight completo
            (mismo object-fit:cover que la foto base) y el wrapper con
            overflow:hidden solo destapa la franja correspondiente, así el
            blur queda alineado píxel a píxel con la foto de abajo. */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: franjaEncabezado, overflow: 'hidden' }}>
          <img
            src={fondoUri ?? '/default_bg.jpg'}
            alt=""
            style={{ position: 'absolute', top: fondoTop, left: 0, width: '100%', height: fondoAlto, objectFit: 'cover', filter: 'blur(16px)' }}
          />
        </div>
        <div data-testid="story-zona-pie" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: zonaPie, overflow: 'hidden' }}>
          <img
            src={fondoUri ?? '/default_bg.jpg'}
            alt=""
            style={{ position: 'absolute', top: zonaPie - fondoAlto, left: 0, width: '100%', height: fondoAlto, objectFit: 'cover', filter: 'blur(16px)' }}
          />
        </div>

        {/* Dark overlay — cubre todo el canvas de punta a punta. Antes era
            más liviano (0.38) y el oscurecido real venía de un panel
            redondeado inset por encima, que dejaba un margen de foto sin
            oscurecer alrededor y dos tintes distintos superpuestos.
            Unificado en una sola capa pareja (feedback de diseño
            2026-08-17): la foto sigue de ambientación pero el oscurecido no
            tiene "marco". */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

        {/* Content layer — margen respecto al borde del canvas nada más; ya
            no tiene su propio panel/tinte, el oscurecido parejo de arriba
            alcanza para la legibilidad (con el text-shadow de cada
            elemento). */}
        <div
          data-testid="story-contenido"
          style={{
            position: 'absolute', inset: 0,
            padding: `${safe.top - SUBIDA_ENCABEZADO}px 18px ${safe.bottom}px`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            {/* Header — chip de fecha + nombre en serif + caption ("TURNOS
                DISPONIBLES") + fecha/rango, vuelto a como estaba (feedback
                de clientes 2026-08-17: les gustaba este estilo). Colores
                fijos (no colors.* / var(--ag-*)): esta imagen es un export
                fijo que no debe cambiar según el tema claro/oscuro activo
                del editor al momento de generarla, y html-to-image además
                descarta las custom properties heredadas al capturar (mismo
                problema que primaryRaw/primaryDeepRaw resuelven en
                theme/colors.ts). */}
            <div>
            {/* Con servicios elegidos el encabezado mantiene exactamente el
                tamaño de producción (insignia 44px, titular 18px, línea 11px):
                tiene que entrar en la franja desenfocada y una quincena no
                tiene alto de sobra. Solo cambian los textos: la categoría va
                en el titular y "Turnos disponibles con X · fecha" en la línea
                chica (canvas con medidas reales, aprobado 2026-10-11). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              {/* Texto a la izquierda, en el mismo borde que los días de la
                  lista; la insignia queda de sello a la derecha. Etiqueta (10px)
                  + 5px + título (24px) = 39px: entra en los 44px de la insignia,
                  así el encabezado no crece. */}
              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <div
                  data-testid="story-kicker"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 8, fontWeight: 700,
                    letterSpacing: '0.2em', lineHeight: '10px', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                  }}
                >
                  <span>{titulo}</span>
                  {profesionalNombre && (
                    <>
                      <span aria-hidden style={{ width: 16, height: 1, flexShrink: 0, background: 'rgba(255,255,255,0.55)' }} />
                      <span>{t.rich('withProfessionalRich', { nombre: profesionalNombre, b: enNegrita })}</span>
                    </>
                  )}
                </div>
                {/* maxFontSize 24: con la fecha ya fuera de la fila del título
                    (feedback 2026-08-17: 22 quedaba grande "al lado de la
                    fecha") hay ancho de sobra. FitText lo baja hasta 13 si la
                    categoría es larga — nunca por debajo de la info de los
                    turnos del body (maxFontSize 10). */}
                <div style={{ marginTop: 5 }}>
                  <FitText
                    testId="story-titulo"
                    text={conServicios && filtroServicios
                      ? t.rich('availableTitleFor', { categoria: filtroServicios.titulo, em: enCursiva })
                      : t.rich('availableTitle', { em: enCursiva })}
                    maxFontSize={24}
                    minFontSize={13}
                    style={{
                      fontFamily: agendaFontSerif, fontWeight: 400, color: '#fff', textAlign: 'left',
                      letterSpacing: '-0.025em', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                    }}
                  />
                </div>
              </div>

              {insignia}
            </div>

            {conServicios && (
              <div
                data-testid="story-servicios"
                style={{
                  marginTop: SEPARACION_BAJADA, fontFamily: agendaFontSerif, fontStyle: 'italic', fontWeight: 400,
                  fontSize: TAMANO_LINEA_SERVICIOS, lineHeight: `${ALTO_RENGLON_SERVICIOS}px`, color: 'rgba(255,255,255,0.88)',
                  textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                  maxHeight: ALTO_RENGLON_SERVICIOS * MAX_LINEAS_SERVICIOS, overflow: 'hidden',
                }}
              >
                {/* Los nombres van tal cual se escriben (cursiva, sin
                    mayúsculas ni espaciado) y se miden con la misma fuente
                    (medirTextoServicios), así el aviso y la imagen coinciden. */}
                {renglonesServicios.map((renglon, r) => (
                  <div key={r} style={{ whiteSpace: 'nowrap' }}>
                    {renglon.map((nombre, idx) => (
                      <Fragment key={idx}>
                        {idx > 0 && (
                          <span
                            data-testid="story-separador"
                            aria-hidden
                            style={{
                              display: 'inline-block', width: 4, height: 4, margin: '0 6px', verticalAlign: 'middle',
                              background: 'rgba(255,255,255,0.6)', transform: 'rotate(45deg)',
                            }}
                          />
                        )}
                        <span>{nombre}</span>
                      </Fragment>
                    ))}
                  </div>
                ))}
              </div>
            )}
            </div>

            <div
              data-testid="story-linea-encabezado"
              style={{ height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.04))', marginTop: aireArribaLinea }}
            />

            {/* Body */}
            <div ref={cuerpoRef} data-testid="story-cuerpo" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: aireAbajoLinea, marginBottom: 14 }}>
              {esModoDia ? (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', alignContent: 'center',
                  justifyContent: 'center', gap: 10,
                }}>
                  {dias[0]?.slots.filter(s => s.libre).map((slot, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '45%', height: 44, borderRadius: 10,
                        background: 'rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{slot.hora}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div data-testid="story-lista" style={{ display: 'flex', flexDirection: 'column', gap: gapLista }}>
                  {dias.map((dia, idx) => {
                    const slotsLibres = dia.slots.filter(s => s.libre);
                    const estaCompleto = slotsLibres.length === 0;
                    const { abrev, numero } = partesDia(dia.fecha);

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', lineHeight: '14px' }}>
                        {/* Estilo "carta": el día a la izquierda, las horas a la
                            derecha y una línea de puntos que las une. El día
                            lleva flexShrink:0 + whiteSpace:nowrap y un ancho
                            fijo — sin eso, una fila con muchas horas le comía
                            ancho y las líneas de puntos de cada fila quedaban
                            desalineadas (ver pattern_flex_minwidth_long_names).
                            El día va en sans (abreviatura chica y tenue, número
                            en negrita); la fila mide 14px, así la quincena no
                            se aprieta. */}
                        <span data-testid="story-dia" style={{
                          width: 40, flexShrink: 0, color: '#fff', display: 'flex', alignItems: 'baseline',
                          gap: 6, whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            minWidth: 20, fontSize: 8, fontWeight: 700, letterSpacing: '0.16em',
                            textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
                          }}>
                            {abrev}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{numero}</span>
                        </span>
                        <span
                          aria-hidden
                          style={{
                            flex: 1, minWidth: 12, margin: '0 8px', alignSelf: 'center',
                            borderBottom: '1px dotted rgba(255,255,255,0.4)', transform: 'translateY(1px)',
                          }}
                        />
                        {estaCompleto ? (
                          // Blanco atenuado, no primaryRaw (verde salvia de
                          // marca del sistema): esta imagen la comparten los
                          // negocios que alquilan la app y el color del
                          // sistema no los representa — mismo criterio que el
                          // footer y que el acento de TarjetaPrecios. Además
                          // "Completo" es el estado SIN turnos, tiene que
                          // recederse frente a las horas disponibles en
                          // blanco pleno, no gritar con un color.
                          <span style={{
                            color: 'rgba(255,255,255,0.5)', fontFamily: agendaFontSerif, fontSize: 12, fontStyle: 'italic', flexShrink: 0,
                          }}>
                            {t('complete')}
                          </span>
                        ) : (
                          // flex 0 1 auto + maxWidth: el bloque mide lo que
                          // miden las horas (queda pegado a la derecha) y solo
                          // se achica si no entran en el ancho que deja el día.
                          <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: canvasWidth - 36 - 40 - 28 }}>
                            <FitText
                              testId="story-horas"
                              text={(() => {
                                const { numeros, unidad } = partirHoras(slotsLibres.map(s => s.hora));
                                return (
                                  <>
                                    {numeros.map((n, i) => (
                                      <Fragment key={i}>
                                        {i > 0 && <SeparadorHoras />}
                                        <span style={{ fontFamily: FUENTE_SANS, fontStyle: 'normal', fontWeight: 500, fontSize: '0.875em', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                                      </Fragment>
                                    ))}
                                    {unidad && (
                                      <span data-testid="story-unidad" style={{ fontSize: '0.7em', opacity: 0.65, marginLeft: '0.3em', fontStyle: 'normal' }}>{unidad}</span>
                                    )}
                                  </>
                                );
                              })()}
                              maxFontSize={12}
                              style={{ color: '#fff', fontFamily: agendaFontSerif, fontStyle: 'italic', fontWeight: 400, textAlign: 'right' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Línea divisoria + footer de contacto (CTA, negocio y teléfono):
                componente compartido con la historia de precios (ver
                PieContacto) para que las dos no se desalineen. Los refs
                caen en los mismos nodos que antes: se miden para la zona
                de blur del pie. */}
            <PieContacto nombre={nombreEstudio} telefono={telefonoEstudio} lineaRef={lineaRef} pieRef={pieRef} />
          </div>
        </div>

        {/* Free-floating draggable texts */}
        {textosLibres.map(item => (
          <TextoDraggable
            key={item.id}
            item={item}
            onMover={onMoverTexto}
            onResize={onResizeTexto}
            onEditar={onEditarTexto}
            escala={escala}
          />
        ))}
      </div>
    </div>
  );
});
