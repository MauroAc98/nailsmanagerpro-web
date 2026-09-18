'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { nombreDia } from '@/lib/dateFormat';
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

  return (
    <div style={{ padding: '0 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 15, color: colors.textStrong }}>
          {t('thisWeek')}
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
          const tieneTurnos = (countByDate.get(cellStr) ?? 0) > 0;

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
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                backgroundColor: tieneTurnos ? colors.primary : 'transparent',
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
