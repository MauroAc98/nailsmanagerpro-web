'use client';

import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { DisponibilidadDia } from '@/services/turnoService';
import { TextoLibre } from '@/hooks/useGenerarHistoria';
import { TextoDraggable } from '@/components/historia/TextoDraggable';
import { primaryRaw } from '@/theme/colors';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${DAYS[d.getDay()].toUpperCase()} ${d.getDate()}`;
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
  // undefined = cuenta con ≤1 profesional activa o vista "default": no se
  // agrega la línea extra, el canvas queda pixel-idéntico a como estaba
  // antes de esta feature.
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
  const esModoDia = dias.length === 1;

  // Cuando la profesional seleccionada es la dueña, su Profesional.nombre
  // suele ser el mismo texto que nombreEstudio (se siembra igual al
  // registrarse — ver AuthController::register) y nunca se vuelven a
  // sincronizar. Sin este chequeo, la historia mostraba el mismo nombre
  // dos veces apiladas.
  const mostrarProfesional = !!profesionalNombre
    && profesionalNombre.trim().toLowerCase() !== (nombreEstudio ?? '').trim().toLowerCase();

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

        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />

        {/* Content layer */}
        <div
          style={{
            position: 'absolute', inset: 0,
            padding: '20px 18px 12px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {nombreEstudio && (
              // minFontSize 12: siempre por encima del tope de FitText de los
              // turnos (maxFontSize 10) — el título nunca queda mas chico que
              // la info de los turnos.
              <FitText
                text={nombreEstudio.toUpperCase()}
                maxFontSize={17}
                minFontSize={12}
                style={{ fontWeight: 700, letterSpacing: 1, color: '#fff', textAlign: 'center' }}
              />
            )}
            <span style={{
              fontSize: 15, fontWeight: 300, letterSpacing: 6, color: '#fff', textAlign: 'center',
              marginTop: nombreEstudio ? 4 : 0,
            }}>
              {titulo.toUpperCase()}
            </span>
            {mostrarProfesional && (
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 2, color: 'rgba(255,255,255,0.85)',
                textAlign: 'center', marginTop: 4,
              }}>
                {profesionalNombre!.toUpperCase()}
              </span>
            )}
            <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.4)', marginTop: 8 }} />
          </div>

          {/* Body */}
          {esModoDia ? (
            <div style={{
              flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'center',
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
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', gap,
            }}>
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
                        COMPLETO 🤍
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

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 300, letterSpacing: 4, color: '#fff', opacity: 0.7 }}>
              RESERVÁ TU LUGAR
            </span>
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
