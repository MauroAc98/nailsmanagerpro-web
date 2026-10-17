'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { nombreMes, fechaDeHoy } from '@/lib/dateFormat';
import type { TurnoMes } from '@/services/turnoService';
import { formatCellDate } from './agendaDateHelpers';

// ─────────────────────────────────────────────
// CalendarioMensual — pure JS, no library. Ya no se muestra siempre en la
// pantalla principal (Change 1) — vive detrás del sheet "Elegir fecha" que
// abre WeekStrip (components/agenda/WeekStrip.tsx), sin cambios de lógica
// propios (mismo componente, solo cambió DÓNDE se monta).
// ─────────────────────────────────────────────
export function CalendarioMensual({
  viewDate,
  onMonthChange,
  fechaSeleccionada,
  turnosMes,
  onDayClick,
  diaDeshabilitado,
  diasConPunto,
  etiquetas,
  mesMinimo,
}: {
  viewDate:         Date;
  onMonthChange:    (d: Date) => void;
  fechaSeleccionada: string;
  turnosMes:        TurnoMes[];
  onDayClick:       (fecha: string) => void;
  // Opcionales (los usa la reserva online, la agenda propia no).
  diaDeshabilitado?: (fecha: string) => boolean;
  diasConPunto?:     string[];
  // Opcional (lo usa el portal de profesionales): con etiquetas los días son
  // botones con nombre accesible y las flechas llevan nombre y miden 44px.
  // Sin ellas todo queda igual que antes.
  etiquetas?: {
    anterior:  string;
    siguiente: string;
    dia:       (fecha: string, cantidad: number) => string;
  };
  // Opcional: primer mes navegable ("YYYY-MM"). Antes de él la flecha anterior
  // queda deshabilitada.
  mesMinimo?: string;
}) {
  const todayStr = fechaDeHoy();
  // Con etiquetas cada día es un botón (teclado y lector de pantalla); sin ellas, la celda simple de siempre.
  const Celda = etiquetas ? 'button' : 'div';
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Semana arranca en lunes, como el resto del calendario del rediseño.
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // count per day — same source RN's CalendarDay reads from (marcasMes),
  // used uniformly for every cell including the selected one
  const countByDate = new Map(turnosMes.map(t => [t.fecha, t.cantidad]));
  const conPunto = new Set(diasConPunto ?? []);

  const mesAnterior = new Date(year, month - 1, 1);
  const anteriorBloqueado = mesMinimo !== undefined && formatCellDate(mesAnterior).slice(0, 7) < mesMinimo;
  const navStyle = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex',
    ...(etiquetas && { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }),
  } as const;

  // Build 42-cell grid (6 rows × 7 cols)
  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + 1 + i),
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - firstDayOfMonth - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), isCurrentMonth: false });
  }

  return (
    <div style={{ padding: '0 20px 12px' }}>
    <div style={{
      padding: 16, borderRadius: 24,
      border: `1px solid ${colors.border}`, backgroundColor: colors.surface, boxShadow: shadows.card,
    }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={() => { if (!anteriorBloqueado) onMonthChange(mesAnterior); }}
          disabled={anteriorBloqueado}
          aria-label={etiquetas?.anterior}
          style={anteriorBloqueado ? { ...navStyle, cursor: 'default', opacity: 0.35 } : navStyle}
        >
          <ChevronLeft size={18} color={colors.sub} strokeWidth={2} />
        </button>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.textStrong, textTransform: 'capitalize' }}>
          {nombreMes(viewDate, 'long')} {year}
        </span>
        <button
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          aria-label={etiquetas?.siguiente}
          style={navStyle}
        >
          <ChevronRight size={18} color={colors.sub} strokeWidth={2} />
        </button>
      </div>

      {/* Day headers — L M M J V S D, semana arranca en lunes como el rediseño */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginBottom: 4 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px 0' }}>
        {cells.map((cell, idx) => {
          const cellStr    = formatCellDate(cell.date);
          const isSelected = cellStr === fechaSeleccionada;
          const isToday    = cellStr === todayStr;
          const count      = countByDate.get(cellStr) ?? 0;
          const esPasado   = cellStr < todayStr;
          const deshabilitado = diaDeshabilitado?.(cellStr) ?? false;

          return (
            <Celda
              key={idx}
              data-testid={`cal-day-${cellStr}`}
              data-fuera-del-mes={cell.isCurrentMonth ? undefined : 'true'}
              aria-disabled={deshabilitado || undefined}
              onClick={() => { if (!deshabilitado) onDayClick(cellStr); }}
              {...(etiquetas && {
                type: 'button' as const,
                disabled: deshabilitado,
                'aria-label': etiquetas.dia(cellStr, count),
                'aria-pressed': isSelected,
                'aria-current': isToday ? ('date' as const) : undefined,
              })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px 0', cursor: deshabilitado ? 'default' : 'pointer',
                opacity: cell.isCurrentMonth ? (deshabilitado ? 0.35 : 1) : 0.1,
                ...(etiquetas && { width: '100%', border: 'none', background: 'none', font: 'inherit' }),
              }}
            >
              {/* Circle */}
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? colors.primarySolid : 'transparent',
                boxShadow: isSelected ? `0 2px 4px ${withAlpha(colors.primary, '4D')}` : 'none',
                position: 'relative',
              }}>
                <span style={{
                  fontFamily: isSelected || isToday ? agendaFontSerif : undefined,
                  fontSize: 15,
                  fontWeight: isSelected || (isToday && !isSelected) ? 700 : 400,
                  color: isSelected
                    ? colors.primaryFg
                    : esPasado
                      ? colors.placeholder
                      : isToday
                        ? colors.primaryDeep
                        : colors.text,
                }}>
                  {cell.date.getDate()}
                </span>

                {/* Badge — any future day with turnos, count from turnosMes */}
                {count > 0 && !esPasado && !isSelected && (
                  <div style={{
                    position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
                    minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px',
                    backgroundColor: colors.primarySoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: colors.primaryDeep }}>
                      {count}
                    </span>
                  </div>
                )}

                {/* Punto de disponibilidad (reserva online) */}
                {conPunto.has(cellStr) && !isSelected && (
                  <div data-punto="" style={{
                    position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                    width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary,
                  }} />
                )}

                {/* Past-day dot — plain, no count */}
                {count > 0 && esPasado && !isSelected && (
                  <div data-punto-pasado="" style={{
                    position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: 2, backgroundColor: colors.divider,
                  }} />
                )}
              </div>
            </Celda>
          );
        })}
      </div>
    </div>
    </div>
  );
}
