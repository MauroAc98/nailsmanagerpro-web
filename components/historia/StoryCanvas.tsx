'use client';

import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';
import { DisponibilidadDia } from '@/services/turnoService';
import { TextoLibre } from '@/hooks/useGenerarHistoria';
import { TextoDraggable } from '@/components/historia/TextoDraggable';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { primaryRaw } from '@/theme/colors';
import { agendaFontSerif } from '@/theme/agendaColors';
import { nombreDia as nombreDiaIntl } from '@/lib/dateFormat';

function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${nombreDiaIntl(d, 'short', 'mayusculas')} ${d.getDate()}`;
}

// ─────────────────────────────────────────────
// FitText — shrinks font-size until the text fits on one line, instead of
// truncating with an ellipsis. Mirrors RN's `adjustsFontSizeToFit` (used on
// the "horas" row) — with ellipsis, busy days with many free slots were
// silently hiding real hours instead of just rendering them smaller.
// ─────────────────────────────────────────────
function FitText({
  text, maxFontSize, minFontSize = 6, style,
}: {
  text: string;
  maxFontSize: number;
  minFontSize?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = maxFontSize;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > minFontSize) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [text, maxFontSize, minFontSize]);

  return (
    <span
      ref={ref}
      style={{ ...style, fontSize, whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', width: '100%' }}
    >
      {text}
    </span>
  );
}

interface Props {
  titulo:         string;
  // Nombre del estudio (User.name / "Nombre del estudio" en perfil) — línea
  // de marca, siempre visible cuando existe.
  nombreEstudio?: string | null;
  // Teléfono del estudio (User.telefono, mismo dato que Perfil → Datos
  // personales) — se muestra en el footer para que quien vea la historia
  // compartida sepa por dónde contactar, sin tener que buscarlo aparte.
  telefonoEstudio?: string | null;
  // Multi-agenda — nombre de la profesional cuya disponibilidad se muestra.
  // Si viene, reemplaza a nombreEstudio como título (ver tituloPrincipal).
  // undefined = cuenta con ≤1 profesional activa o sin selección puntual:
  // el título vuelve a ser nombreEstudio, canvas pixel-idéntico a como
  // estaba antes de esta feature.
  profesionalNombre?: string;
  dias:           DisponibilidadDia[]; // diasAMostrar
  fondoUri:       string | null;
  canvasWidth:    number;
  canvasHeight:   number;
  textosLibres:   TextoLibre[];
  onMoverTexto:   (id: string, x: number, y: number) => void;
  onResizeTexto:  (id: string, fontSize: number) => void;
  onEditarTexto:  (id: string) => void;
}

// ─────────────────────────────────────────────
// StoryCanvas — DOM-rendered shareable "story" preview.
// forwardRef exposes the outer node for html-to-image capture.
// ─────────────────────────────────────────────
export const StoryCanvas = forwardRef<HTMLDivElement, Props>(function StoryCanvas(
  { titulo, nombreEstudio, telefonoEstudio, profesionalNombre, dias, fondoUri, canvasWidth, canvasHeight, textosLibres, onMoverTexto, onResizeTexto, onEditarTexto },
  ref
) {
  const t = useTranslations('historia.StoryCanvas');
  const esModoDia = dias.length === 1;

  // Chip de fecha en el header — solo tiene sentido en modo Día (una fecha
  // puntual). En Semana/Mes no hay "un" día que mostrar ahí: inventar uno
  // (el primero del rango, por ejemplo) sugeriría que solo ese día tiene
  // turnos. Ahí el chip cae a un ícono genérico en vez de un número.
  const fechaChip     = esModoDia && dias[0] ? new Date(dias[0].fecha + 'T00:00:00') : null;
  const chipDiaLabel  = fechaChip ? nombreDiaIntl(fechaChip, 'short', 'mayusculas') : null;
  const chipDiaNumero = fechaChip ? fechaChip.getDate() : null;

  // Con una profesional puntual elegida, su nombre reemplaza al del estudio
  // en el título — mostrar ambos es redundante (la propia profesional YA
  // identifica de qué estudio es) y en cuentas donde el nombre del estudio
  // es el nombre personal de la dueña, quedaba dos veces literal.
  const tituloPrincipal = profesionalNombre || nombreEstudio;

  const alturaUtil = canvasHeight * 0.75;
  const gap        = Math.max(4, Math.min(20, (alturaUtil - dias.length * 20) / (dias.length + 1)));

  // Zonas de blur local detrás de título y footer — alto aproximado, no
  // medido en vivo (alcanza para cubrir cómodamente el chip+nombre+caption
  // arriba y el bloque de reservas abajo con margen).
  const tituloZonaAlto = Math.round(canvasHeight * 0.15);
  const footerZonaAlto = Math.round(canvasHeight * 0.09);

  return (
    // Wrapper solo para el look on-screen (esquinas redondeadas). El nodo
    // capturado por html-to-image es el de más adentro (el que tiene `ref`)
    // y NO tiene borderRadius propio — si lo tuviera, quedaría horneado en
    // el PNG exportado como esquinas transparentes/negras. Instagram y
    // WhatsApp Status muestran la imagen full-bleed, así que un PNG con
    // esquinas redondeadas se ve como si no llenara el recuadro (era un
    // solo bug con dos síntomas, no dos bugs distintos).
    <div style={{ width: canvasWidth, height: canvasHeight, margin: '0 auto', borderRadius: 16, overflow: 'hidden' }}>
      <div
        ref={ref}
        style={{
          width:    '100%',
          height:   '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <img
          src={fondoUri ?? '/default_bg.jpg'}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: tituloZonaAlto, overflow: 'hidden' }}>
          <img
            src={fondoUri ?? '/default_bg.jpg'}
            alt=""
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: canvasHeight, objectFit: 'cover', filter: 'blur(16px)' }}
          />
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: footerZonaAlto, overflow: 'hidden' }}>
          <img
            src={fondoUri ?? '/default_bg.jpg'}
            alt=""
            style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: canvasHeight, objectFit: 'cover', filter: 'blur(16px)' }}
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
          style={{
            position: 'absolute', inset: 0,
            padding: '20px 18px 16px',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            {/* Header — chip de fecha + nombre en serif + caption ("{fecha} ·
                TURNOS DISPONIBLES"), flotando directo sobre el panel general
                (mismo criterio que el resto del header/body/footer) en vez
                de tener su propio panel anidado — un segundo panel con otro
                tinte adentro del panel general sumaba un escalón de
                contraste de más (feedback de diseño 2026-08-17). El chip
                translúcida como el resto (feedback de diseño 2026-08-17),
                no una superficie opaca — otro "panel" compitiendo. Colores
                fijos (no colors.* / var(--ag-*)): esta imagen es un export
                fijo que no debe cambiar según el tema claro/oscuro activo
                del editor al momento de generarla, y html-to-image además
                descarta las custom properties heredadas al capturar (mismo
                problema que primaryRaw/primaryDeepRaw resuelven en
                theme/colors.ts). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <span style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
              }}>
                {chipDiaNumero !== null ? (
                  <>
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1, color: '#fff', textTransform: 'uppercase' }}>
                      {chipDiaLabel}
                    </span>
                    <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, lineHeight: 1, color: '#fff', marginTop: 1 }}>
                      {chipDiaNumero}
                    </span>
                  </>
                ) : (
                  <CalendarDays size={18} color="#fff" strokeWidth={2} />
                )}
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                {tituloPrincipal && (
                  // minFontSize 15: siempre muy por encima del tope de FitText
                  // de los turnos en el body (maxFontSize 10) — el nombre
                  // nunca queda mas chico que la info de los turnos.
                  <FitText
                    text={tituloPrincipal}
                    maxFontSize={22}
                    minFontSize={15}
                    style={{
                      fontFamily: agendaFontSerif, fontWeight: 400, color: '#fff', textAlign: 'left',
                      letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                    }}
                  />
                )}
                {/* Dos líneas separadas, no concatenadas — en modo Semana la
                    fecha ("17 al 23 de agosto") ya es larga por sí sola, y
                    sumarle "· TURNOS DISPONIBLES" en el mismo renglón lo
                    hacía correr y perder orden. */}
                <span style={{
                  display: 'block', marginTop: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: '#fff', textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                }}>
                  {t('availableAppointments')}
                </span>
                <span style={{
                  display: 'block', marginTop: 2, fontSize: 10, fontWeight: 400,
                  color: 'rgba(255,255,255,0.8)', textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                }}>
                  {titulo}
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '14px 0' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap }}>
                  {dias.map((dia, idx) => {
                    const slotsLibres = dia.slots.filter(s => s.libre);
                    const estaCompleto = slotsLibres.length === 0;
                    const horasTexto = slotsLibres.map(s => s.hora).join(' · ');

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <span style={{
                          width: 52, color: '#fff', fontSize: 10, fontWeight: 700,
                          letterSpacing: 0.5, textTransform: 'uppercase',
                        }}>
                          {nombreDia(dia.fecha)}
                        </span>
                        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.35)', margin: '0 8px' }} />
                        {estaCompleto ? (
                          <span style={{
                            color: primaryRaw, fontSize: 9, fontWeight: 600,
                            fontStyle: 'italic', letterSpacing: 0.5,
                          }}>
                            {t('complete')}
                          </span>
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <FitText
                              text={horasTexto}
                              maxFontSize={10}
                              style={{ color: '#fff', fontWeight: 400, letterSpacing: 0.3 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer — con teléfono, "RESERVAS" + ícono de WhatsApp +
                número, flotando sobre el panel general sin caja propia
                — mismo criterio que el header, nada de paneles anidados. El
                ícono (no la palabra "WhatsApp" escrita) para quedar
                consistente con cómo se representa esa acción en el resto de
                la app (Recordatorios, botón de turno). Sin teléfono cargado
                no hay número que mostrar, así que cae al CTA genérico de
                siempre. */}
            {telefonoEstudio ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {t('reservationsLabel')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <WhatsappGlyph size={11} color="#fff" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {telefonoEstudio}
                  </span>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 8, fontWeight: 300, letterSpacing: 4, color: '#fff', opacity: 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {t('bookYourSpot')}
              </span>
            )}
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
          />
        ))}
      </div>
    </div>
  );
});
