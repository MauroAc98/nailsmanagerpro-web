'use client';

import React from 'react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { DisponibilidadDia } from '@/services/turnoService';
import { claveSlot } from '@/hooks/useGenerarHistoria';
import { nombreDia as nombreDiaIntl } from '@/lib/dateFormat';

function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${nombreDiaIntl(d, 'short', 'mayusculas')} ${d.getDate()}`;
}

interface Props {
  agenda:              DisponibilidadDia[]; // diasQuincena — positional index matters for toggleSlot
  diasOcultos:         string[];
  slotsOcultos:        string[]; // claveSlot(fecha, hora) — solo slots que el sistema marca libres
  onToggleSlot:        (fechaIdx: number, slotIdx: number) => void;
  onOcultarDia:        (fecha: string) => void;
  onToggleHoraEnTodos: (hora: string) => void;
}

export function AgendaEditor({ agenda, diasOcultos, slotsOcultos, onToggleSlot, onOcultarDia, onToggleHoraEnTodos }: Props) {
  // Horas distintas entre los días visibles, para ofrecer un toggle único
  // que oculte/restaure esa hora en todos de una — evita tener que ir
  // día por día tildando el mismo horario.
  const horasDistintas = Array.from(
    new Set(agenda.flatMap(dia => dia.slots.map(s => s.hora)))
  ).sort();

  return (
    <div style={{
      width: '100%', backgroundColor: colors.surface, padding: 15, borderRadius: 15,
      boxShadow: shadows.card,
    }}>
      {horasDistintas.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: colors.textStrong, marginBottom: 6 }}>
            Ocultar un horario en todos los días de esta vista
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {horasDistintas.map(hora => {
              const algunaVisible = agenda.some(dia =>
                dia.slots.some(s => s.hora === hora && s.libre && !slotsOcultos.includes(claveSlot(dia.fecha, s.hora)))
              );
              return (
                <button
                  key={hora}
                  type="button"
                  onClick={() => onToggleHoraEnTodos(hora)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, border: `1px solid ${algunaVisible ? colors.primaryDeep : colors.border}`,
                    background: algunaVisible ? 'transparent' : colors.surfaceSubtle,
                    color: algunaVisible ? colors.primaryDeep : colors.placeholder,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {hora}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p style={{ fontSize: 11, color: colors.placeholder, margin: 0 }}>
          Tocá un turno para ocultarlo, o el ojo para ocultar el día
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {agenda.map((dia, fechaIdx) => {
            const oculto = diasOcultos.includes(dia.fecha);
            return (
              <div
                key={dia.fecha}
                style={{
                  width: 150, flexShrink: 0,
                  background: colors.surfaceSubtle,
                  borderRadius: 10, border: `1px solid ${colors.border}`,
                  opacity: oculto ? 0.7 : 1, padding: 10,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: oculto ? colors.placeholder : colors.textStrong }}>
                    {nombreDia(dia.fecha)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOcultarDia(dia.fecha)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    {oculto ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Slot chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                  {dia.slots.map((slot, slotIdx) => {
                    // Un turno ocupado (!slot.libre) nunca es togglable — no
                    // hay forma de que termine mostrándose como disponible.
                    const bloqueado  = !slot.libre;
                    const slotOculto = slotsOcultos.includes(claveSlot(dia.fecha, slot.hora));
                    const off        = bloqueado || slotOculto || oculto;
                    const clickeable = !oculto && !bloqueado;
                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        disabled={oculto || bloqueado}
                        onClick={() => clickeable && onToggleSlot(fechaIdx, slotIdx)}
                        style={{
                          padding: '5px 8px', borderRadius: 5, minWidth: 40, border: 'none',
                          // colors.border (línea divisoria) no fondo de pill: al reforzar
                          // su contraste para separadores reales quedó casi igual a
                          // colors.placeholder, y texto placeholder sobre fondo border
                          // se volvía ilegible (gris sobre gris). surfaceSubtle es el
                          // token correcto para "fondo apagado con texto encima".
                          background: off ? colors.surfaceSubtle : colors.primarySolid,
                          color: off ? colors.placeholder : colors.primaryFg,
                          fontSize: 10, fontWeight: 700,
                          cursor: clickeable ? 'pointer' : 'default',
                        }}
                      >
                        {slot.hora}
                      </button>
                    );
                  })}
                </div>

                {oculto && (
                  <p style={{ fontSize: 9, color: colors.placeholder, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
                    No aparece en la historia
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {agenda.length > 2 && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 4, width: 28,
            background: `linear-gradient(to right, transparent, ${colors.surface})`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
    </div>
  );
}
