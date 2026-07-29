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
  { titulo, nombreEstudio, profesionalNombre, dias, fondoUri, canvasWidth, canvasHeight, textosLibres, onMoverTexto, onResizeTexto, onEditarTexto },
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
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: 8, fontWeight: 300, letterSpacing: 4, color: '#fff', opacity: 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {t('bookYourSpot')}
              </span>
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
