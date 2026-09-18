'use client';

import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { nombreDia, nombreMes, fechaDeHoy } from '@/lib/dateFormat';
import type { TurnoMes } from '@/services/turnoService';
import { formatCellDate } from './agendaDateHelpers';

// ─────────────────────────────────────────────
// etiquetaRangoSemana — rango real de días de la tira ("14 – 20 de
// septiembre"), no el mes/año suelto que mostraba antes: ese label no
// representaba bien lo que la tira efectivamente muestra (7 días
// puntuales, no un mes completo) — feedback directo del usuario. Semana
// dentro de un mismo mes: "14 – 20 de septiembre" (mes una sola vez, al
// final). Semana que cruza de mes: "30 de nov – 6 de dic" (mes corto en
// cada punta, evita ambigüedad sobre a qué mes pertenece cada día).
// ─────────────────────────────────────────────
function etiquetaRangoSemana(dates: Date[]): string {
  const primero = dates[0];
  const ultimo  = dates[dates.length - 1];
  const mismoMes = primero.getMonth() === ultimo.getMonth() && primero.getFullYear() === ultimo.getFullYear();

  if (mismoMes) {
    return `${primero.getDate()} – ${ultimo.getDate()} de ${nombreMes(ultimo, 'long', 'ninguna')}`;
  }
  return `${primero.getDate()} de ${nombreMes(primero, 'short', 'ninguna')} – ${ultimo.getDate()} de ${nombreMes(ultimo, 'short', 'ninguna')}`;
}

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
  const rangoSemana = etiquetaRangoSemana(dates);

  return (
    <div style={{ padding: '0 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>
            {t('weekEyebrow')}
          </p>
          <span style={{ fontFamily: agendaFontSerif, fontWeight: 600, fontSize: 19, color: colors.textStrong }}>
            {rangoSemana}
          </span>
        </div>
        {/* Botón-ícono en vez de texto "Elegir fecha" — separa "esto es lo
            que estás viendo" (rango de arriba) de "esto es una acción",
            en vez de dos textos compitiendo uno al lado del otro. */}
        <button
          onClick={onAbrirCalendario}
          aria-label={t('chooseDate')}
          style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 19,
            border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Calendar size={17} color={colors.primaryDeep} strokeWidth={2} />
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
