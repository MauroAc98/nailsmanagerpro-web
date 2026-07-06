'use client';

import React, { forwardRef } from 'react';
import { DisponibilidadDia } from '@/services/turnoService';
import { TextoLibre, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/hooks/useGenerarHistoria';
import { TextoDraggable } from '@/components/historia/TextoDraggable';
import { colors } from '@/theme/colors';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${DAYS[d.getDay()].toUpperCase()} ${d.getDate()}`;
}

interface Props {
  titulo:        string;
  dias:          DisponibilidadDia[]; // diasAMostrar
  fondoUri:      string | null;
  textosLibres:  TextoLibre[];
  onMoverTexto:  (id: string, x: number, y: number) => void;
}

// ─────────────────────────────────────────────
// StoryCanvas — DOM-rendered shareable "story" preview.
// forwardRef exposes the outer node for html-to-image capture.
// ─────────────────────────────────────────────
export const StoryCanvas = forwardRef<HTMLDivElement, Props>(function StoryCanvas(
  { titulo, dias, fondoUri, textosLibres, onMoverTexto },
  ref
) {
  const esModoDia = dias.length === 1;

  const alturaUtil = CANVAS_HEIGHT * 0.75;
  const gap        = Math.max(4, Math.min(20, (alturaUtil - dias.length * 20) / (dias.length + 1)));

  return (
    <div
      ref={ref}
      style={{
        width:        CANVAS_WIDTH,
        height:       CANVAS_HEIGHT,
        margin:       '0 auto',
        position:     'relative',
        overflow:     'hidden',
        borderRadius: 16,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{
            fontSize: 15, fontWeight: 300, letterSpacing: 6, color: '#fff', textAlign: 'center',
          }}>
            {titulo.toUpperCase()}
          </span>
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
                      color: colors.primary, fontSize: 9, fontWeight: 600,
                      fontStyle: 'italic', letterSpacing: 0.5,
                    }}>
                      COMPLETO 🤍
                    </span>
                  ) : (
                    <span style={{
                      flex: 1, color: '#fff', fontSize: 10, fontWeight: 400, letterSpacing: 0.3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {horasTexto}
                    </span>
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
        <TextoDraggable key={item.id} item={item} onMover={onMoverTexto} />
      ))}
    </div>
  );
});
