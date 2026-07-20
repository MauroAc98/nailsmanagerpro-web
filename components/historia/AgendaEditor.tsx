'use client';

import React from 'react';
import { colors, shadows } from '@/theme/colors';
import { DisponibilidadDia } from '@/services/turnoService';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${DAYS[d.getDay()].toUpperCase()} ${d.getDate()}`;
}

interface Props {
  agenda:              DisponibilidadDia[]; // diasQuincena — positional index matters for toggleSlot
  diasOcultos:         string[];
  onToggleSlot:        (fechaIdx: number, slotIdx: number) => void;
  onOcultarDia:        (fecha: string) => void;
  onToggleHoraEnTodos: (hora: string) => void;
}

export function AgendaEditor({ agenda, diasOcultos, onToggleSlot, onOcultarDia, onToggleHoraEnTodos }: Props) {
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
      <p style={{ fontSize: 12, fontWeight: 700, color: colors.subtext, marginBottom: 8 }}>
        Tocá un turno para ocultarlo, o el ojo para ocultar el día (Deslizá →):
      </p>

      {horasDistintas.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: colors.subtext, marginBottom: 6 }}>
            Ocultar un horario en todos los días de esta vista:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {horasDistintas.map(hora => {
              const algunaLibre = agenda.some(dia =>
                dia.slots.some(s => s.hora === hora && s.libre)
              );
              return (
                <button
                  key={hora}
                  type="button"
                  onClick={() => onToggleHoraEnTodos(hora)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, border: `1px solid ${algunaLibre ? colors.primary : colors.border}`,
                    background: algunaLibre ? 'transparent' : colors.surfaceSubtle,
                    color: algunaLibre ? colors.primary : colors.placeholder,
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Slot chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                {dia.slots.map((slot, slotIdx) => {
                  const off = !slot.libre || oculto;
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      disabled={oculto}
                      onClick={() => !oculto && onToggleSlot(fechaIdx, slotIdx)}
                      style={{
                        padding: '5px 8px', borderRadius: 5, minWidth: 40, border: 'none',
                        background: off ? colors.border : colors.primary,
                        color: off ? colors.placeholder : '#fff',
                        fontSize: 10, fontWeight: 700,
                        cursor: oculto ? 'default' : 'pointer',
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
    </div>
  );
}
