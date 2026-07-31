'use client';

import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DisponibilidadDia } from '@/services/turnoService';
import { TextoLibre } from '@/hooks/useGenerarHistoria';
import { TextoDraggable } from '@/components/historia/TextoDraggable';
import { primaryRaw } from '@/theme/colors';
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

  // Con una profesional puntual elegida, su nombre reemplaza al del estudio
  // en el título — mostrar ambos es redundante (la propia profesional YA
  // identifica de qué estudio es) y en cuentas donde el nombre del estudio
  // es el nombre personal de la dueña, quedaba dos veces literal.
  const tituloPrincipal = profesionalNombre || nombreEstudio;

  const alturaUtil = canvasHeight * 0.75;
  const gap        = Math.max(4, Math.min(20, (alturaUtil - dias.length * 20) / (dias.length + 1)));

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

        {/* Dark overlay — mas liviano que antes (0.72 -> 0.38): la foto queda
            mas visible como ambientacion, y la legibilidad del contenido pasa
            a apoyarse en el text-shadow (header/footer) y en la tarjeta propia
            del bloque de disponibilidad (ver "Body" mas abajo), no en oscurecer
            toda la imagen por igual. */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)' }} />

        {/* Content layer — margen respecto al borde del canvas nada más; el
            panel de abajo es el que realmente engloba todo (header, body,
            footer). */}
        <div
          style={{
            position: 'absolute', inset: 0,
            padding: '20px 18px 16px',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Panel único: envuelve título/marca, disponibilidad y el CTA
              final, todo bajo la misma "pintura" (opacidad baja, sin borde ni
              sombra). No le agrega altura por fila a nada — el padding es
              fijo una sola vez para todo el bloque, así que un mes completo
              (31 días) sigue entrando igual que antes; ver el cálculo de
              gap/filas más abajo, que ya contempla el recorte del padding. */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '16px 14px', borderRadius: 20,
            background: 'rgba(0,0,0,0.34)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {tituloPrincipal && (
                // minFontSize 12: siempre por encima del tope de FitText de los
                // turnos (maxFontSize 10) — el título nunca queda mas chico que
                // la info de los turnos.
                <FitText
                  text={tituloPrincipal.toUpperCase()}
                  maxFontSize={17}
                  minFontSize={12}
                  style={{ fontWeight: 700, letterSpacing: 1, color: '#fff', textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,0.85)' }}
                />
              )}
              <span style={{
                fontSize: 15, fontWeight: 300, letterSpacing: 6, color: '#fff', textAlign: 'center',
                marginTop: tituloPrincipal ? 4 : 0, textShadow: '0 2px 6px rgba(0,0,0,0.85)',
              }}>
                {titulo.toUpperCase()}
              </span>
              <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.55)', marginTop: 8 }} />
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

            {/* Footer */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 300, letterSpacing: 4, color: '#fff', opacity: 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {t('bookYourSpot')}
              </span>
              {/* Mismo tratamiento que el CTA de arriba (texto translúcido +
                  sombra, sin fondo propio) — el ícono alcanza para
                  diferenciarlo sin competirle protagonismo al "reservá tu
                  lugar", que tiene que seguir siendo lo primero que se lee. */}
              {telefonoEstudio && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0.5, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {telefonoEstudio}
                  </span>
                </div>
              )}
            </div>
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
