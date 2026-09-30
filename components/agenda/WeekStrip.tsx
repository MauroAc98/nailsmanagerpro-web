'use client';

import { useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { nombreDia, nombreMes, fechaDeHoy } from '@/lib/dateFormat';
import type { TurnoMes } from '@/services/turnoService';
import { formatCellDate } from './agendaDateHelpers';

// ─────────────────────────────────────────────
// etiquetaRangoSemana — rango real de días de la tira ("14 – 20 de
// sept"), no el mes/año suelto que mostraba antes: ese label no
// representaba bien lo que la tira efectivamente muestra (7 días
// puntuales, no un mes completo) — feedback directo del usuario. Mes
// abreviado siempre, para que entren las flechas y el botón "Calendario" en
// una fila. Semana dentro de un mismo mes: "14 – 20 de sept" (mes una sola
// vez, al final). Semana que cruza de mes: "30 de nov – 6 de dic" (mes en
// cada punta, evita ambigüedad sobre a qué mes pertenece cada día).
// ─────────────────────────────────────────────
function etiquetaRangoSemana(dates: Date[]): string {
  const primero = dates[0];
  const ultimo  = dates[dates.length - 1];
  const mismoMes = primero.getMonth() === ultimo.getMonth() && primero.getFullYear() === ultimo.getFullYear();

  if (mismoMes) {
    return `${primero.getDate()} – ${ultimo.getDate()} de ${nombreMes(ultimo, 'short', 'ninguna')}`;
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
  onSemanaAnterior,
  onSemanaSiguiente,
  diaDeshabilitado,
  diasConPunto,
  semanaAnteriorDeshabilitada = false,
  semanaSiguienteDeshabilitada = false,
}: {
  dates:             Date[];
  fechaSeleccionada: string;
  turnosMes:         TurnoMes[];
  onDayClick:        (fecha: string) => void;
  onAbrirCalendario: () => void;
  onSemanaAnterior:  () => void;
  onSemanaSiguiente: () => void;
  // Opcionales (los usa la reserva online, la agenda propia no): dias que no
  // se pueden elegir, dias con un punto (ej. "hay lugar") y flechas apagadas.
  diaDeshabilitado?:            (fecha: string) => boolean;
  diasConPunto?:                string[];
  semanaAnteriorDeshabilitada?: boolean;
  semanaSiguienteDeshabilitada?: boolean;
}) {
  const t = useTranslations('agenda.WeekStrip');
  const countByDate = new Map(turnosMes.map(tm => [tm.fecha, tm.cantidad]));
  const todayStr = fechaDeHoy();
  const rangoSemana = etiquetaRangoSemana(dates);

  const conPunto = new Set(diasConPunto ?? []);

  // Redesign (selector de semana, Change: "táctil + hoy marcado") — antes
  // eran botones sin fondo ni borde de 40px; ahora son un círculo con
  // fondo y borde, mismo tamaño de toque pero más fáciles de ubicar como
  // botón (antes se confundían con espacio vacío al lado del rango de fechas).
  const flecha: React.CSSProperties = {
    width: 36, height: 36, flexShrink: 0, borderRadius: 18,
    border: `1px solid ${colors.hairline}`, backgroundColor: colors.surface, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const flechaApagada: React.CSSProperties = { ...flecha, cursor: 'default', opacity: 0.3 };

  return (
    <div style={{ padding: '0 20px 12px' }}>
      {/* Fila de navegación: ‹ rango+calendario › ›. Las flechas mueven de a
          una semana sin abrir el calendario. El rango de fechas y el botón
          de calendario se fusionaron en un solo botón (redesign: "táctil +
          hoy marcado") — antes competían por espacio en una sola fila; ahora
          el rango es el título y "Ver mes completo" es la acción, apiladas.
          El aria-label sigue siendo el mismo de siempre (openCalendar), así
          que la reserva online (HorarioScreen, que solo depende del
          aria-label del botón, no de su forma) no se ve afectada. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={onSemanaAnterior}
          disabled={semanaAnteriorDeshabilitada}
          aria-label={t('previousWeek')}
          style={semanaAnteriorDeshabilitada ? flechaApagada : flecha}
        >
          <ChevronLeft size={20} color={colors.text} strokeWidth={2.2} />
        </button>
        <button
          onClick={onAbrirCalendario}
          aria-label={t('openCalendar')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
            border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0',
          }}
        >
          <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.textStrong }}>
            {rangoSemana}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.primaryDeep }}>
            <Calendar size={13} color={colors.primaryDeep} strokeWidth={2} />
            {t('calendarLabel')}
          </span>
        </button>
        <button
          onClick={onSemanaSiguiente}
          disabled={semanaSiguienteDeshabilitada}
          aria-label={t('nextWeek')}
          style={semanaSiguienteDeshabilitada ? flechaApagada : flecha}
        >
          <ChevronRight size={20} color={colors.text} strokeWidth={2.2} />
        </button>
      </div>

      {/* Días como pastillas: abreviatura, número en serif y, abajo, el
          badge con la cantidad (día futuro) o un punto (día pasado). */}
      <div style={{ display: 'flex', gap: 6 }}>
        {dates.map((date) => {
          const cellStr    = formatCellDate(date);
          const isSelected = cellStr === fechaSeleccionada;
          const cantidad   = countByDate.get(cellStr) ?? 0;
          const esPasado   = cellStr < todayStr;
          const esHoy      = cellStr === todayStr;
          const mostrarBadge = cantidad > 0 && !esPasado && !isSelected;
          // "HOY" solo cuando no hay badge que mostrar (el badge ya es
          // suficiente señal) y no es el día seleccionado (que ya se
          // distingue por el resaltado de color).
          const mostrarHoy = esHoy && !mostrarBadge && !isSelected;
          const mostrarPunto = !mostrarHoy && ((cantidad > 0 && esPasado && !isSelected) || (conPunto.has(cellStr) && !isSelected));
          const deshabilitado = diaDeshabilitado?.(cellStr) ?? false;

          return (
            <button
              key={cellStr}
              data-testid={`week-day-${cellStr}`}
              disabled={deshabilitado}
              onClick={() => onDayClick(cellStr)}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 0', borderRadius: 16, cursor: deshabilitado ? 'default' : 'pointer',
                opacity: deshabilitado ? 0.35 : 1,
                border: `1px solid ${isSelected ? colors.primarySolid : colors.hairline}`,
                backgroundColor: isSelected ? colors.primarySolid : colors.surface,
                boxShadow: isSelected ? `0 4px 10px ${withAlpha(colors.primary, '4D')}` : 'none',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                color: isSelected ? withAlpha(colors.primaryFg, 'BF') : colors.muted,
              }}>
                {nombreDia(date, 'short').slice(0, 3)}
              </span>
              <span style={{
                marginTop: 2, fontFamily: agendaFontSerif, fontSize: 17,
                fontWeight: isSelected ? 700 : 400,
                color: isSelected ? colors.primaryFg : colors.text,
              }}>
                {date.getDate()}
              </span>
              <span style={{ height: 14, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mostrarBadge ? (
                  <span style={{
                    minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px', backgroundColor: colors.primarySoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: colors.primaryDeep }}>{cantidad}</span>
                  </span>
                ) : mostrarHoy ? (
                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.3, color: colors.primary }}>
                    {t('today')}
                  </span>
                ) : (
                  <span data-punto={mostrarPunto ? '' : undefined} style={{
                    width: 5, height: 5, borderRadius: 3,
                    backgroundColor: mostrarPunto ? colors.primary : 'transparent',
                  }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
