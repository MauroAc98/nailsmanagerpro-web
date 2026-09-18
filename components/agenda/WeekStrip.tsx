'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { nombreDia, nombreMes, fechaDeHoy } from '@/lib/dateFormat';
import type { TurnoMes } from '@/services/turnoService';
import { formatCellDate } from './agendaDateHelpers';

// ─────────────────────────────────────────────
// getCurrentWeekDates — pure helper, Monday-start (same week-start
// convention as CalendarioMensual's firstDayOfMonth math in
// app/(app)/agenda/page.tsx). Computes the 7 dates of the week containing
// `hoy` (defaults to "now") — this is the week WeekStrip shows, independent
// of viewDate/month navigation.
// ─────────────────────────────────────────────
export function getCurrentWeekDates(hoy: Date = new Date()): Date[] {
  const dayOfWeek = (hoy.getDay() + 6) % 7; // Monday=0 .. Sunday=6
  const monday = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

// ─────────────────────────────────────────────
// WeekStrip — collapsed inline view of the current week (redesign Change 1):
// reemplaza al grid mensual completo, que antes vivía siempre visible en la
// pantalla principal y ahora vive, sin cambios de lógica, detrás del sheet
// "Elegir fecha" (ver AgendaPage). onDayClick es el mismo handleDayClick de
// siempre — tocar un día acá se comporta exactamente igual que tocarlo en
// el grid mensual.
// ─────────────────────────────────────────────
export function WeekStrip({
  dates,
  fechaSeleccionada,
  turnosMes,
  onDayClick,
  onAbrirCalendario,
}: {
  dates:             Date[];
  fechaSeleccionada: string;
  turnosMes:         TurnoMes[];
  onDayClick:        (fecha: string) => void;
  onAbrirCalendario: () => void;
}) {
  const t = useTranslations('agenda.WeekStrip');
  const countByDate = new Map(turnosMes.map(tm => [tm.fecha, tm.cantidad]));
  const todayStr = fechaDeHoy();

  // "Esta semana" quedaba mal apenas la tira dejó de mostrar siempre la
  // semana actual (ahora sigue al día elegido en "Elegir fecha", que puede
  // caer en cualquier mes). En su lugar, mes/año calculado sobre el
  // miércoles de la tira (índice 2) — evita el caso borde de una semana que
  // cruza dos meses mostrando el mes "equivocado" más veces que el otro.
  const mesReferencia = dates[2] ?? dates[0];
  const etiquetaMes = `${nombreMes(mesReferencia, 'long')} ${mesReferencia.getFullYear()}`;

  return (
    <div style={{ padding: '0 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 15, color: colors.textStrong, textTransform: 'capitalize' }}>
          {etiquetaMes}
        </span>
        <button
          onClick={onAbrirCalendario}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, color: colors.primaryDeep,
          }}
        >
          {t('chooseDate')}
          <ChevronRight size={14} color={colors.primaryDeep} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {dates.map((date) => {
          const cellStr    = formatCellDate(date);
          const isSelected = cellStr === fechaSeleccionada;
          const cantidad   = countByDate.get(cellStr) ?? 0;
          const esPasado   = cellStr < todayStr;
          // Mismo criterio que CalendarioMensual (Change 1 lo colapsó a esta
          // tira, no lo reemplazó): día futuro con turnos -> badge con la
          // cantidad; día pasado con turnos -> punto simple, sin número (ya
          // pasó, no hace falta el detalle); sin turnos o día seleccionado
          // (su círculo ya está lleno) -> nada.
          const mostrarBadge = cantidad > 0 && !esPasado && !isSelected;
          const mostrarPunto = cantidad > 0 && esPasado && !isSelected;

          return (
            <button
              key={cellStr}
              data-testid={`week-day-${cellStr}`}
              onClick={() => onDayClick(cellStr)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: colors.muted, textTransform: 'uppercase' }}>
                {nombreDia(date, 'short').charAt(0).toUpperCase()}
              </span>
              <span style={{
                width: 32, height: 32, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: isSelected ? agendaFontSerif : undefined,
                fontWeight: isSelected ? 700 : 600,
                fontSize: isSelected ? 16 : 14,
                color: isSelected ? colors.primaryFg : colors.text,
                backgroundColor: isSelected ? colors.primarySolid : 'transparent',
                boxShadow: isSelected ? `0 2px 4px ${withAlpha(colors.primary, '4D')}` : 'none',
              }}>
                {date.getDate()}
              </span>
              {mostrarBadge ? (
                <span style={{
                  minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px',
                  backgroundColor: colors.primarySoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: colors.primaryDeep }}>
                    {cantidad}
                  </span>
                </span>
              ) : (
                <span style={{
                  width: 4, height: 4, borderRadius: 2,
                  backgroundColor: mostrarPunto ? colors.divider : 'transparent',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
