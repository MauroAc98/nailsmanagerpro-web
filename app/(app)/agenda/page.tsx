'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Camera, ChevronLeft, ChevronRight, Check, Plus, SlidersHorizontal, X } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { turnoService, Turno, TurnoMes } from '@/services/turnoService';
import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { SubscriptionWarningBanner, useSubscriptionWarningVisible } from '@/components/SubscriptionWarningBanner';
import { PendientesDeCobroBanner, usePendientesDeCobroVisible } from '@/components/PendientesDeCobroBanner';
import { RecordatoriosPendientesBanner, useRecordatoriosPendientesVisible } from '@/components/RecordatoriosPendientesBanner';
import { NotificacionesBell } from '@/components/NotificacionesBell';
import { ResumenMesCard } from '@/components/agenda/ResumenMesCard';
import { SwipeableTurnoCard } from '@/components/agenda/SwipeableTurnoCard';
import { WeekStrip, getCurrentWeekDates } from '@/components/agenda/WeekStrip';
import { horaDeHora, formatFechaMini, formatCellDate, parseFechaLocal, type ProfesionalLabel } from '@/components/agenda/agendaDateHelpers';
import { SelectorServicios } from '@/components/SelectorServicios';
import { alertDialog } from '@/store/useConfirmStore';
import { pedirMotivoCancelacion } from '@/store/useMotivoCancelacionStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE, NAV_MARGIN } from '@/constants/layout';
import { nombreDia, nombreMes, fechaDeHoy, formatoYMD } from '@/lib/dateFormat';
import { pickVisibleBanner, type BannerKey } from '@/lib/bannerPriority';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// sessionStorage key prefix for the per-banner "dismissed for this session"
// flag (Change 2) — same sessionStorage-not-localStorage pattern as
// BIENVENIDA_KEY in store/useAuthStore.ts (survives an accidental refresh,
// clears when the tab closes).
const BANNER_DISMISSED_PREFIX = 'agenda_banner_dismissed_';

// Lazy initializer (no efecto) — AgendaPage vive detrás del boot gate de
// autenticación (app/providers.tsx: BootSplash hasta authStatus ===
// 'authenticated', ver esa condición ahí) y por lo tanto nunca se sirve con
// contenido real desde el servidor; no hay riesgo de mismatch de hidratación
// al leer sessionStorage durante el render inicial acá, a diferencia de un
// componente que sí se renderiza en el server con contenido real.
function useDismissedBanner(key: BannerKey): [boolean, () => void] {
  const storageKey = BANNER_DISMISSED_PREFIX + key;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // sin sessionStorage — igual ocultamos para esta sesión en memoria
    }
    setDismissed(true);
  }, [storageKey]);

  return [dismissed, dismiss];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
// Parses manually (not `new Date(fechaStr)`) to avoid the UTC-midnight shift
// that flips the displayed day for negative-offset timezones like ART.
function formatFechaCorta(fechaStr: string): string {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dia  = nombreDia(date, 'short');
  const mes  = nombreMes(date, 'long', 'ninguna').slice(0, 3);
  return `${dia} ${d} de ${mes}`;
}

// ─────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

// ─────────────────────────────────────────────
// FinalizadoCard — opacity 0.6, no swipe
// ─────────────────────────────────────────────
function FinalizadoCard({ turno, profesionalLabel }: { turno: Turno; profesionalLabel?: ProfesionalLabel | null }) {
  const t = useTranslations('agenda.FinalizadoCard');
  return (
    <div style={{ opacity: 0.6 }}>
      <div style={{
        backgroundColor: colors.surfaceSubtle, borderRadius: 18,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        padding: '12px 26px 12px 16px', display: 'flex', alignItems: 'center', minHeight: 75,
      }}>
        {/* Sección hora */}
        <div style={{
          width: 70, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0,
        }}>
          <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.muted, letterSpacing: 0 }}>
            {horaDeHora(turno.fecha_hora)}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: colors.subtext, marginTop: 2, textTransform: 'uppercase' }}>
            {formatFechaMini(turno.fecha_hora)}
          </span>
          {profesionalLabel && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3, marginTop: 2,
              maxWidth: 64, overflow: 'hidden',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                backgroundColor: profesionalLabel.color,
              }} />
              <span style={{
                fontSize: 9, fontWeight: 700, color: colors.subtext,
                textTransform: 'uppercase', letterSpacing: 0.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profesionalLabel.nombre}
              </span>
            </span>
          )}
          <div style={{ position: 'absolute', right: 0, top: '20%', height: '60%', width: 1, backgroundColor: colors.divider }} />
        </div>

        {/* Sección info central */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 15 }}>
          <p style={{
            fontSize: 16, fontWeight: 600, color: colors.muted, margin: 0, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {turno.cliente ? `${turno.cliente.nombre} ${turno.cliente.apellido}` : t('deletedClient')}
          </p>
          <p style={{
            fontSize: 13, color: colors.subtext, fontStyle: 'italic', margin: '2px 0 0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + ')}
          </p>
        </div>

        {/* Sección acción — mismo lugar que el badge de SwipeableTurnoCard
            en_curso (columna propia a la derecha), para que el badge de
            estado no se mezcle con el nombre/servicio del bloque central. */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 0.6, textTransform: 'uppercase',
            backgroundColor: colors.primarySoft,
            borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
          }}>
            <Check size={9} color={colors.primaryDeep} strokeWidth={3.5} />
            {t('finished')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AgendaListHeader — title + filter toggle button + inline loading spinner
// ─────────────────────────────────────────────
function AgendaListHeader({
  hayFiltroActivo,
  cargando,
  onAbrirFiltros,
  fechaSeleccionada,
  esHoy,
}: {
  hayFiltroActivo: boolean;
  cargando: boolean;
  onAbrirFiltros: () => void;
  fechaSeleccionada: string;
  esHoy: boolean;
}) {
  const t = useTranslations('agenda.AgendaListHeader');
  const titulo = hayFiltroActivo
    ? t('results')
    : esHoy ? t('todayAppointments') : t('appointmentsOf', { fecha: formatFechaCorta(fechaSeleccionada) });

  return (
    <div style={{ paddingBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong }}>
          {titulo}
        </span>

        <button
          onClick={onAbrirFiltros}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 20,
            border: `1px solid ${hayFiltroActivo ? 'transparent' : colors.border}`,
            backgroundColor: hayFiltroActivo ? colors.primarySolid : colors.surface,
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={14} color={hayFiltroActivo ? colors.primaryFg : colors.text} strokeWidth={2} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: hayFiltroActivo ? colors.primaryFg : colors.text }}>
            {hayFiltroActivo ? t('activeFilters') : t('filter')}
          </span>
        </button>
      </div>

      {cargando && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div
            className="loader-spinner"
            style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${colors.border}`, borderTopColor: colors.primaryDeep }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Date filter parsing — ported verbatim from RN's FiltroSheet.tsx
// ─────────────────────────────────────────────
function autoFormatearFecha(texto: string, anterior: string): string {
  if (texto.length < anterior.length) return texto;

  let soloNums = texto.replace(/[^\d]/g, '');
  if (soloNums.length > 8) soloNums = soloNums.slice(0, 8);

  if (soloNums.length > 4) {
    return `${soloNums.slice(0, 2)}/${soloNums.slice(2, 4)}/${soloNums.slice(4)}`;
  }
  if (soloNums.length > 2) {
    return `${soloNums.slice(0, 2)}/${soloNums.slice(2)}`;
  }
  return soloNums;
}

function parsearFecha(input: string): string | null {
  const partes = input.split('/');
  if (partes.length !== 3) return null;

  const [diaStr, mesStr, anioStr] = partes;
  const dia  = parseInt(diaStr, 10);
  const mes  = parseInt(mesStr, 10);
  const anio = parseInt(anioStr, 10);

  if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
  if (dia < 1 || dia > 31)        return null;
  if (mes < 1 || mes > 12)        return null;
  if (anio < 2000 || anio > 2100) return null;
  if (anioStr.length !== 4)       return null;

  // Componentes locales (año, mes-1, día), NO new Date(fecha) sobre el
  // string ISO: ese constructor parsea "YYYY-MM-DD" como UTC medianoche, y
  // en husos negativos (ART/BRT, UTC-3) eso cae en el día anterior en hora
  // local — el día 1 de cualquier mes se leía como el mes anterior y
  // rechazaba fechas válidas ("Fecha inválida" para un 01/03/2026 real).
  // Mismo patrón que formatFechaCorta (arriba, línea ~67), que ya lo hace
  // bien.
  const d = new Date(anio, mes - 1, dia);
  if (isNaN(d.getTime()))       return null;
  if (d.getMonth() + 1 !== mes) return null;

  const fecha = `${anioStr}-${mesStr.padStart(2, '0')}-${diaStr.padStart(2, '0')}`;
  return fecha;
}

// ─────────────────────────────────────────────
// FiltroSheetContent — search by client name, arbitrary date, service
// ─────────────────────────────────────────────
function FiltroSheetContent({
  textoBusqueda,
  servicioFiltro,
  fechaFiltro,
  serviciosActivos,
  hayFiltroActivo,
  onChangeBusqueda,
  onLimpiarBusqueda,
  onChangeServicioFiltro,
  onCambiarFecha,
  onLimpiarTodo,
  onAplicar,
}: {
  textoBusqueda: string;
  servicioFiltro: number | null;
  fechaFiltro: string | null;
  serviciosActivos: Servicio[];
  hayFiltroActivo: boolean;
  onChangeBusqueda: (txt: string) => void;
  onLimpiarBusqueda: () => void;
  onChangeServicioFiltro: (ids: number[]) => void;
  onCambiarFecha: (fecha: string | null) => void;
  onLimpiarTodo: () => void;
  onAplicar: () => void;
}) {
  const t = useTranslations('agenda.FiltroSheetContent');
  const [textoFecha, setTextoFecha] = useState(
    fechaFiltro ? fechaFiltro.split('-').reverse().join('/') : '',
  );
  const [fechaError, setFechaError] = useState(false);

  const btnDeshabilitado = !hayFiltroActivo || fechaError;

  const handleCambiarTextoFecha = (texto: string) => {
    const formateado = autoFormatearFecha(texto, textoFecha);
    setTextoFecha(formateado);
    setFechaError(false);

    if (formateado.length === 0) {
      onCambiarFecha(null);
      return;
    }

    if (formateado.length === 10) {
      const fechaApi = parsearFecha(formateado);
      if (fechaApi) {
        onCambiarFecha(fechaApi);
      } else {
        setFechaError(true);
        onCambiarFecha(null);
      }
    }
  };

  const handleLimpiarFecha = () => {
    setTextoFecha('');
    setFechaError(false);
    onCambiarFecha(null);
  };

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: colors.textStrong }}>{t('title')}</span>
        {hayFiltroActivo && (
          <button
            onClick={() => {
              onLimpiarTodo();
              setTextoFecha('');
              setFechaError(false);
            }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: colors.primaryDeep }}
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Buscar cliente */}
      <p style={{ fontSize: 11, fontWeight: 700, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {t('searchClient')}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', backgroundColor: colors.surfaceSubtle, borderRadius: 12,
        padding: '0 12px', height: 45, marginBottom: 16,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" style={{ marginRight: 8, flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          placeholder={t('clientNamePlaceholder')}
          value={textoBusqueda}
          onChange={e => onChangeBusqueda(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: colors.text, background: 'transparent' }}
        />
        {textoBusqueda !== '' && (
          <button onClick={onLimpiarBusqueda} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </button>
        )}
      </div>

      {/* Buscar por fecha */}
      <p style={{ fontSize: 11, fontWeight: 700, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {t('searchByDate')}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', borderRadius: 12, padding: '0 14px', height: 45,
        border: '1px solid transparent',
        backgroundColor: fechaError ? colors.dangerBg : fechaFiltro ? withAlpha(colors.primary, '12') : colors.surfaceSubtle,
        borderColor: fechaError ? withAlpha(colors.dangerBorder, '44') : fechaFiltro ? withAlpha(colors.primary, '44') : 'transparent',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fechaError ? colors.dangerBorder : fechaFiltro ? colors.primaryDeep : colors.muted} strokeWidth="2" style={{ marginRight: 8, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <input
          value={textoFecha}
          onChange={e => handleCambiarTextoFecha(e.target.value)}
          placeholder={t('datePlaceholder')}
          maxLength={10}
          inputMode="numeric"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: colors.text, background: 'transparent', letterSpacing: 1 }}
        />
        {textoFecha !== '' && (
          <button onClick={handleLimpiarFecha} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fechaError ? colors.dangerBorder : colors.primaryDeep} strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </button>
        )}
      </div>
      {fechaError && (
        <p style={{ fontSize: 11, color: colors.danger, marginTop: 5, marginLeft: 2 }}>{t('invalidDate')}</p>
      )}

      {/* Filtrar por servicio — mismo componente compartido que agenda/nuevo
          y configuracion/profesionales, en `mode: 'single'` (radio
          semantics: tocar el ya elegido lo limpia). Sin buscador propio acá
          (el sheet ya tiene busqueda por nombre y por fecha arriba). */}
      <p style={{ ...sectionLabelStyle, marginTop: fechaError ? 12 : 16 }}>
        {t('filterByService')}
      </p>
      <div style={{ marginBottom: 20 }}>
        <SelectorServicios
          servicios={serviciosActivos}
          mode="single"
          selectedIds={servicioFiltro !== null ? [servicioFiltro] : []}
          onChange={onChangeServicioFiltro}
        />
      </div>

      <button
        onClick={onAplicar}
        disabled={btnDeshabilitado}
        style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          backgroundColor: btnDeshabilitado ? colors.divider : colors.primarySolid,
          color: colors.primaryFg, fontSize: 15, fontWeight: 600,
          cursor: btnDeshabilitado ? 'default' : 'pointer',
        }}
      >
        {t('viewResults')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// CalendarioMensual — pure JS, no library. Ya no se muestra siempre en la
// pantalla principal (Change 1) — vive detrás del sheet "Elegir fecha" que
// abre WeekStrip (components/agenda/WeekStrip.tsx), sin cambios de lógica
// propios (mismo componente, solo cambió DÓNDE se monta).
// ─────────────────────────────────────────────
function CalendarioMensual({
  viewDate,
  onMonthChange,
  fechaSeleccionada,
  turnosMes,
  onDayClick,
}: {
  viewDate:         Date;
  onMonthChange:    (d: Date) => void;
  fechaSeleccionada: string;
  turnosMes:        TurnoMes[];
  onDayClick:       (fecha: string) => void;
}) {
  const todayStr = fechaDeHoy();
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Semana arranca en lunes, como el resto del calendario del rediseño.
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // count per day — same source RN's CalendarDay reads from (marcasMes),
  // used uniformly for every cell including the selected one
  const countByDate = new Map(turnosMes.map(t => [t.fecha, t.cantidad]));

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
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          <ChevronLeft size={18} color={colors.sub} strokeWidth={2} />
        </button>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.textStrong, textTransform: 'capitalize' }}>
          {nombreMes(viewDate, 'long')} {year}
        </span>
        <button
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          <ChevronRight size={18} color={colors.sub} strokeWidth={2} />
        </button>
      </div>

      {/* Day headers — L M M J V S D, semana arranca en lunes como el rediseño */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((cell, idx) => {
          const cellStr    = formatCellDate(cell.date);
          const isSelected = cellStr === fechaSeleccionada;
          const isToday    = cellStr === todayStr;
          const count      = countByDate.get(cellStr) ?? 0;
          const esPasado   = cellStr < todayStr;

          return (
            <div
              key={idx}
              onClick={() => onDayClick(cellStr)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px 0', cursor: 'pointer',
                opacity: cell.isCurrentMonth ? 1 : 0.1,
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

                {/* Past-day dot — plain, no count */}
                {count > 0 && esPasado && !isSelected && (
                  <div style={{
                    position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: 2, backgroundColor: colors.divider,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SelectorProfesionalDia — pill dinámico de profesional, invisible para
// cuentas con ≤1 profesional activa. Solo muestra profesionales que tienen
// al menos un turno vigente ese día, más un "Todas" implícito que fusiona
// la vista (comportamiento por defecto).
// ─────────────────────────────────────────────
function SelectorProfesionalDia({
  profesionales,
  filtroActivo,
  onSeleccionar,
}: {
  profesionales: Profesional[];
  filtroActivo:  number | null;
  onSeleccionar: (id: number | null) => void;
}) {
  const t = useTranslations('agenda.SelectorProfesionalDia');
  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <button
        onClick={() => onSeleccionar(null)}
        style={{
          flexShrink: 0, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
          border: `1px solid ${filtroActivo === null ? colors.primarySolid : colors.divider}`,
          backgroundColor: filtroActivo === null ? colors.primarySolid : colors.surface,
          color: filtroActivo === null ? colors.primaryFg : colors.text,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {t('all')}
      </button>
      {profesionales.map(p => {
        const selected = filtroActivo === p.id;
        const color = p.color || colors.primary;
        return (
          <button
            key={p.id}
            onClick={() => onSeleccionar(selected ? null : p.id)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
              border: `1px solid ${selected ? color : colors.divider}`,
              backgroundColor: selected ? color : colors.surface,
              color: selected ? colors.primaryFg : colors.text,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 4, flexShrink: 0, backgroundColor: selected ? colors.primaryFg : color }} />
            {p.nombre}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// AgendaPage
// ─────────────────────────────────────────────
export default function AgendaPage() {
  const router = useRouter();
  const t = useTranslations('agenda.AgendaPage');
  const tElegirFecha = useTranslations('agenda.ElegirFechaSheet');

  const {
    turnos, turnosMes, loading,
    fechaSeleccionada, fetchTurnos, fetchTurnosMes, errorMes,
    completarTurno, cancelarTurno, setFechaSeleccionada,
    turnosBusqueda, cargandoBusqueda,
    buscarPorNombre, buscarPorServicio, buscarPorFecha, limpiarBusqueda,
  } = useTurnoStore();

  // Sin esto, un fallo de red al traer el mes se veía indistinguible de
  // "no hay turnos este mes" — el calendario quedaba sin badges y sin
  // ningún aviso de que en realidad falló la carga.
  useEffect(() => {
    if (errorMes) showToast(errorMes);
  }, [errorMes]);

  const { servicios, fetchServicios } = useServiciosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [textoBusqueda,   setTextoBusqueda]   = useState('');
  const [servicioFiltro,  setServicioFiltro]  = useState<number | null>(null);
  const [fechaFiltro,     setFechaFiltro]     = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [profesionalFiltro, setProfesionalFiltro] = useState<number | null>(null);
  const [turnosMesFiltrado, setTurnosMesFiltrado] = useState<TurnoMes[]>([]);
  const [viewDate,        setViewDate]        = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const bottomSheetRef = useRef<BottomSheetHandle>(null);
  const filtroSheetRef = useRef<BottomSheetHandle>(null);
  // Sheet "Elegir fecha" (Change 1) — hospeda el CalendarioMensual sin
  // cambios de lógica, solo detrás de una acción explícita en vez de
  // siempre visible en la pantalla principal.
  const elegirFechaSheetRef = useRef<BottomSheetHandle>(null);

  const hayFiltroActivo = !!textoBusqueda || servicioFiltro !== null || fechaFiltro !== null;
  const hoy = fechaDeHoy();
  const esFechaPasada = fechaSeleccionada < hoy;

  // ─────────────────────────────────────────────
  // Banner de atención único (Change 2) — solo el de mayor prioridad ENTRE
  // los que aplican se renderiza; el resto queda oculto (no desmontado: los
  // otros dos hooks de visibilidad igual corren para poder reevaluar la
  // prioridad en cualquier momento). Cada banner tiene su propio flag de
  // "descartado esta sesión" en sessionStorage — mismo patrón que
  // BIENVENIDA_KEY (store/useAuthStore.ts) — así que descartar uno no oculta
  // a uno de mayor prioridad que aparezca después.
  // ─────────────────────────────────────────────
  const subscriptionVisible   = useSubscriptionWarningVisible();
  const cobrosVisible         = usePendientesDeCobroVisible();
  const recordatoriosVisible  = useRecordatoriosPendientesVisible();
  const [subscriptionDismissed, dismissSubscription]   = useDismissedBanner('subscription');
  const [cobrosDismissed, dismissCobros]               = useDismissedBanner('cobros');
  const [recordatoriosDismissed, dismissRecordatorios] = useDismissedBanner('recordatorios');

  const bannerGanador = pickVisibleBanner(
    { subscription: subscriptionVisible, cobros: cobrosVisible, recordatorios: recordatoriosVisible },
    { subscription: subscriptionDismissed, cobros: cobrosDismissed, recordatorios: recordatoriosDismissed },
  );

  // ─────────────────────────────────────────────
  // Multi-agenda — invisible para cuentas con ≤1 profesional activa (el caso
  // común hoy). Todo lo que sigue en esta sección queda en no-op si
  // mostrarSelectorProfesional es false.
  // ─────────────────────────────────────────────
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

  const profesionalesById = useMemo(
    () => new Map(profesionales.map(p => [p.id, p])),
    [profesionales]
  );

  // Badges del calendario mensual filtrados por profesional — solo se pide
  // cuando hay una profesional puntual seleccionada; con "Todas" alcanza
  // turnosMes de siempre (misma fuente, sin filtrar). El backend filtra
  // server-side (/turnos/marcas?profesional_id=...) y devuelve el mismo
  // agregado liviano {fecha, cantidad} ya filtrado — no trae turnos completos.
  useEffect(() => {
    if (!mostrarSelectorProfesional || profesionalFiltro === null) return;
    let cancelled = false;

    // Limpia antes de pedir: sin esto, al saltar de una profesional a otra
    // (sin pasar por "Todas") los badges quedaban un instante mostrando el
    // conteo de la profesional anterior mientras resuelve el fetch nuevo.
    setTurnosMesFiltrado([]);

    const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    turnoService.getByMes(mes, profesionalFiltro)
      .then(data => { if (!cancelled) setTurnosMesFiltrado(data); })
      .catch(e => console.error('fetchTurnosMesFiltrado:', e));

    return () => { cancelled = true; };
  }, [mostrarSelectorProfesional, profesionalFiltro, viewDate]);

  const turnosMesParaBadges = (mostrarSelectorProfesional && profesionalFiltro !== null)
    ? turnosMesFiltrado
    : turnosMes;

  // Mount: load today's data
  useEffect(() => {
    const today = fechaDeHoy();
    setFechaSeleccionada(today);
    fetchTurnos(today);
    fetchTurnosMes(today.slice(0, 7));
    if (servicios.length === 0) fetchServicios();
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = useCallback((newDate: Date) => {
    setViewDate(newDate);
    const y   = newDate.getFullYear();
    const m   = newDate.getMonth();
    const mes = `${y}-${String(m + 1).padStart(2, '0')}`;
    fetchTurnosMes(mes);

    const today        = new Date();
    const isSameMonth  = today.getFullYear() === y && today.getMonth() === m;
    const newFecha     = isSameMonth
      ? formatoYMD(today)
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    setFechaSeleccionada(newFecha);
    fetchTurnos(newFecha);
    setProfesionalFiltro(null);
  }, [fetchTurnos, fetchTurnosMes, setFechaSeleccionada]);

  const handleDayClick = useCallback((fecha: string) => {
    const parts     = fecha.split('-');
    const y         = Number(parts[0]);
    const m         = Number(parts[1]);
    const cellMonth = m - 1;

    if (cellMonth !== viewDate.getMonth() || y !== viewDate.getFullYear()) {
      setViewDate(new Date(y, cellMonth, 1));
      fetchTurnosMes(`${y}-${String(m).padStart(2, '0')}`);
    }

    setFechaSeleccionada(fecha);
    fetchTurnos(fecha);
    setProfesionalFiltro(null);
  }, [viewDate, fetchTurnos, fetchTurnosMes, setFechaSeleccionada]);

  const handleAbrirElegirFecha = useCallback(() => {
    elegirFechaSheetRef.current?.snapToIndex(0);
  }, []);

  // Tocar un día en el sheet "Elegir fecha" ES la confirmación (spec del
  // Change 1) — no hay botón "aplicar" separado, el mismo tap que selecciona
  // el día también cierra el sheet.
  const handleDayClickEnSheet = useCallback((fecha: string) => {
    handleDayClick(fecha);
    elegirFechaSheetRef.current?.close();
  }, [handleDayClick]);

  // "Hoy" en el header del sheet — solo salta el mes del grid de vuelta al
  // actual, NO selecciona ningún día ni cierra el sheet (spec del Change 1).
  const handleHoy = useCallback(() => {
    const ahora = new Date();
    const nuevoViewDate = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    setViewDate(nuevoViewDate);
    fetchTurnosMes(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`);
  }, [fetchTurnosMes]);

  const handleFinalizar = async (turno: Turno) => {
    const referencias = new Map(servicios.map(s => [s.id, s.precio]));
    const serviciosAPrecificar = turno.servicios
      .filter(s => s != null)
      .map(s => {
        const ref = referencias.get(s.id);
        return {
          servicio_id: s.id,
          nombre: s.nombre,
          precioReferencia: ref != null ? Number(ref) : null,
        };
      });

    const precios = await pedirPreciosServicios(serviciosAPrecificar);
    if (!precios) return;

    const result = await completarTurno(turno.id, precios);
    if (result.success) showToast(t('finished'));
    else await alertDialog(result.message ?? t('finishError'));
  };

  const handleCancelar = async (id: number) => {
    const motivo = await pedirMotivoCancelacion();
    if (!motivo) return;
    const result = await cancelarTurno(id, motivo);
    if (result.success) showToast(t('cancelled'));
    else await alertDialog(result.message ?? t('cancelError'));
  };

  // Debounce: sin esto, cada tecla tipeada dispara un fetch — además de
  // ser un desperdicio, una respuesta vieja que llega después de una más
  // nueva (ej. "ana" resuelve después de "anabel") podía pisar los
  // resultados con el término anterior (la guarda del store evita eso,
  // pero el debounce ya evita disparar la mayoría de esas carreras).
  const busquedaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
  }, []);

  const handleBuscarCliente = useCallback((txt: string) => {
    setTextoBusqueda(txt);
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
    busquedaTimeoutRef.current = setTimeout(() => buscarPorNombre(txt), 300);
  }, [buscarPorNombre]);

  const handleLimpiarBusqueda = useCallback(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
    setTextoBusqueda('');
    buscarPorNombre('');
  }, [buscarPorNombre]);

  const handleChangeServicioFiltro = useCallback((ids: number[]) => {
    const nuevo = ids[0] ?? null;
    setServicioFiltro(nuevo);
    buscarPorServicio(nuevo);
  }, [buscarPorServicio]);

  const handleCambiarFecha = useCallback((fecha: string | null) => {
    setFechaFiltro(fecha);
    buscarPorFecha(fecha);
  }, [buscarPorFecha]);

  const handleLimpiarTodo = useCallback(() => {
    setTextoBusqueda('');
    setServicioFiltro(null);
    setFechaFiltro(null);
    limpiarBusqueda();
    filtroSheetRef.current?.close();
  }, [limpiarBusqueda]);

  const handleAbrirFiltros = useCallback(() => {
    setFiltrosAbiertos(true);
    filtroSheetRef.current?.snapToIndex(0);
  }, []);

  const handleFiltroSheetChange = useCallback((index: number) => {
    setFiltrosAbiertos(index !== -1);
  }, []);

  const serviciosActivos = servicios.filter(s => s.activo);

  // Cancelled turnos never render in either view — safety filter kept from
  // the pre-search implementation (backend already excludes them in practice).
  const vigentes = (list: Turno[]) => list.filter(t => t.estado !== 'cancelado');

  const datosBase = hayFiltroActivo
    ? vigentes(turnosBusqueda)
    : [...vigentes(turnos)].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

  const datosAMostrar = (mostrarSelectorProfesional && profesionalFiltro !== null)
    ? datosBase.filter(t => t.profesional_id === profesionalFiltro)
    : datosBase;

  // La etiqueta de nombre/color en la card solo se muestra en la vista
  // "Todas" (redundante si ya está filtrada a una sola profesional) y solo
  // si hay más de una profesional activa en la cuenta.
  const mostrarEtiquetaProfesionalEnCard = mostrarSelectorProfesional && profesionalFiltro === null;

  const cargandoHeader = loading || cargandoBusqueda;

  return (
    // paddingBottom generoso a propósito: el sheet de turnos es position:fixed
    // y tapa el 30% inferior del viewport incluso en su snap mínimo — sin
    // suficiente scroll debajo del calendario, la última semana del mes
    // queda atrapada detrás del sheet sin forma de verla (ni scrolleando).
    // 340 deja margen incluso con el banner de suscripción visible + card de
    // resumen, en viewports chicos (iPhone SE). Ver components/BottomSheet.tsx.
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 340 }}>

      {/* Header — logo en vez del título de texto, pedido puntual para el
          home (agenda). El resto de las pantallas conserva su título de
          texto normal, esto no es un cambio de convención general. */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* marginLeft 13: no alinea el borde del recorte (el PNG incluye la
            "t" MÁS el swoosh decorativo a su derecha, así que el borde
            izquierdo del archivo no es el centro visual de nada) — alinea
            el centro real de la "t" (medido en píxeles: la letra sola, sin
            el swoosh, ocupa x:[138,410] de 635px de ancho → centro al
            43.15% del ancho del logo) con el centro del ícono circular del
            banner de Pendientes de cobro. */}
        <Image src="/logo-turnetto.png" alt="Turnetto" width={635} height={499} priority style={{ width: 'auto', height: 40, marginLeft: 13 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificacionesBell />
          <button
            onClick={() => router.push(`/agenda/historia?fecha=${fechaSeleccionada}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: colors.text, letterSpacing: 1, textTransform: 'uppercase',
              border: `1px solid ${colors.border}`, borderRadius: 20, padding: '8px 14px',
              backgroundColor: colors.surface, cursor: 'pointer',
            }}>
            <Camera size={16} color={colors.text} strokeWidth={1.8} />
            {t('share')}
          </button>
        </div>
      </div>

      {/* Un solo banner de atención a la vez (Change 2) — prioridad fija
          suscripción > cobros pendientes > recordatorios, ver
          pickVisibleBanner (lib/bannerPriority.ts) más arriba. */}
      {bannerGanador === 'subscription' && <SubscriptionWarningBanner onDismiss={dismissSubscription} />}
      {bannerGanador === 'cobros' && <PendientesDeCobroBanner onDismiss={dismissCobros} />}
      {bannerGanador === 'recordatorios' && <RecordatoriosPendientesBanner onDismiss={dismissRecordatorios} />}

      {/* Resumen del mes — vistazo rápido, detalle completo en
          Configuración → Estadísticas. Se auto-oculta sin turnos este mes. */}
      <div style={{ padding: '12px 20px 0' }}>
        <ResumenMesCard profesionalId={profesionalFiltro} viewDate={viewDate} />
      </div>

      {/* Selector de profesional — invisible con ≤1 profesional activa
          (único gate). Change 3: ahora lista SIEMPRE todas las profesionales
          activas, no solo las que tienen turno en fechaSeleccionada — sigue
          siendo un roster fijo, no un filtro atado al día del calendario. */}
      {mostrarSelectorProfesional && (
        <div style={{ padding: '0 20px 12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>
            {t('team')}
          </p>
          <SelectorProfesionalDia
            profesionales={activeProfesionales}
            filtroActivo={profesionalFiltro}
            onSeleccionar={setProfesionalFiltro}
          />
        </div>
      )}

      {/* Week strip — reemplaza al grid mensual completo en la pantalla
          principal (Change 1); el grid sigue existiendo sin cambios, ahora
          detrás del sheet "Elegir fecha" que abre el botón de acá adentro.
          Dimmed and disabled while a filter is active — mismo criterio que
          tenía el calendario completo antes. */}
      <div style={{ opacity: hayFiltroActivo ? 0.5 : 1, pointerEvents: hayFiltroActivo ? 'none' : 'auto' }}>
        <WeekStrip
          dates={getCurrentWeekDates(parseFechaLocal(fechaSeleccionada))}
          fechaSeleccionada={fechaSeleccionada}
          turnosMes={turnosMesParaBadges}
          onDayClick={handleDayClick}
          onAbrirCalendario={handleAbrirElegirFecha}
        />
      </div>

      {/* Main list sheet — draggable across 30/50/80% of viewport height.
          Sin bottomOffset a propósito — mismo patrón que
          HistorialClienteSheetHost: el sheet llega hasta el borde real de
          pantalla, por DETRÁS del nav (que tiene NAV_Z_INDEX más alto y
          flota encima), en vez de parar arriba de la barra dejando un
          margen/costura visible ahí. sideInset={NAV_MARGIN}: a diferencia de
          HistorialCliente (que solo se ve al abrirlo por acción del
          usuario), este sheet siempre está visible en reposo (peek) —
          full-width por defecto asomaba más ancho que el nav (14px inset a
          los costados) y se leía como un segundo contenedor aparte en vez
          de fundirse en uno solo. */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={[0.3, 0.5, 0.8]}
        initialIndex={0}
        enablePanDownToClose={false}
        handleColor={colors.border}
        backgroundColor={colors.surface}
        sideInset={NAV_MARGIN}
      >
        <div style={{ padding: '0 20px' }}>
          <AgendaListHeader
            hayFiltroActivo={hayFiltroActivo}
            cargando={cargandoHeader}
            onAbrirFiltros={handleAbrirFiltros}
            fechaSeleccionada={fechaSeleccionada}
            esHoy={fechaSeleccionada === hoy}
          />

          {!loading && datosAMostrar.length === 0 && (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 15 }}>
              {hayFiltroActivo
                ? t('noResultsFound')
                : fechaSeleccionada === hoy
                  ? t('noAppointmentsToday')
                  : t('noAppointmentsOn', { fecha: formatFechaCorta(fechaSeleccionada) })}
            </p>
          )}

          {/* Este sheet NO usa bottomOffset — se extiende por detrás del nav
              (que se pinta encima, NAV_Z_INDEX). Sin este padding, los
              últimos turnos de una lista larga quedan tapados por la barra
              aunque scrollees hasta el final. */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            paddingBottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 24px)`,
          }}>
            {datosAMostrar.map(turno => {
              const pasado   = turno.estado_visual === 'completado';
              const cursando = turno.estado_visual === 'en_curso';

              const profesionalDelTurno = mostrarEtiquetaProfesionalEnCard && turno.profesional_id != null
                ? profesionalesById.get(turno.profesional_id)
                : undefined;
              const profesionalLabel = profesionalDelTurno
                ? { nombre: profesionalDelTurno.nombre, color: profesionalDelTurno.color || colors.primary }
                : null;

              // Para el placeholder {profesional} del mensaje de WhatsApp: a
              // diferencia de profesionalLabel, no se oculta con ≤1
              // profesional activa — el mensaje debe ser correcto siempre
              // que el turno tenga profesional resuelta.
              const profesionalNombreWhatsapp = turno.profesional_id != null
                ? profesionalesById.get(turno.profesional_id)?.nombre
                : undefined;

              if (pasado) {
                return <FinalizadoCard key={turno.id} turno={turno} profesionalLabel={profesionalLabel} />;
              }
              return (
                <SwipeableTurnoCard
                  key={turno.id}
                  turno={turno}
                  onCancel={() => handleCancelar(turno.id)}
                  onFinalizar={cursando ? () => handleFinalizar(turno) : undefined}
                  onPress={() => router.push(`/agenda/${turno.id}`)}
                  profesionalLabel={profesionalLabel}
                  profesionalNombreWhatsapp={profesionalNombreWhatsapp}
                />
              );
            })}
          </div>
        </div>
      </BottomSheet>

      {/* Filter sheet — closed by default, opens to 70%, swipe-down to dismiss */}
      <BottomSheet
        ref={filtroSheetRef}
        snapPoints={[0.7]}
        initialIndex={-1}
        enablePanDownToClose
        onChange={handleFiltroSheetChange}
        handleColor={colors.border}
        backgroundColor={colors.surface}
        bottomOffset={NAV_CLEARANCE}
      >
        <FiltroSheetContent
          textoBusqueda={textoBusqueda}
          servicioFiltro={servicioFiltro}
          fechaFiltro={fechaFiltro}
          serviciosActivos={serviciosActivos}
          hayFiltroActivo={hayFiltroActivo}
          onChangeBusqueda={handleBuscarCliente}
          onLimpiarBusqueda={handleLimpiarBusqueda}
          onChangeServicioFiltro={handleChangeServicioFiltro}
          onCambiarFecha={handleCambiarFecha}
          onLimpiarTodo={handleLimpiarTodo}
          onAplicar={() => filtroSheetRef.current?.close()}
        />
      </BottomSheet>

      {/* "Elegir fecha" sheet (Change 1) — hospeda el CalendarioMensual de
          siempre, sin cambios de lógica. Tocar un día ahí ES la confirmación
          (handleDayClickEnSheet cierra el sheet), "Hoy" solo mueve el mes del
          grid sin seleccionar ni cerrar. */}
      <BottomSheet
        ref={elegirFechaSheetRef}
        snapPoints={[0.65]}
        initialIndex={-1}
        enablePanDownToClose
        handleColor={colors.border}
        backgroundColor={colors.surface}
        bottomOffset={NAV_CLEARANCE}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
          <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong }}>
            {tElegirFecha('title')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={handleHoy}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: colors.primaryDeep }}
            >
              {tElegirFecha('today')}
            </button>
            <button
              onClick={() => elegirFechaSheetRef.current?.close()}
              aria-label={tElegirFecha('close')}
              style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} color={colors.text} strokeWidth={2} />
            </button>
          </div>
        </div>
        <CalendarioMensual
          viewDate={viewDate}
          onMonthChange={handleMonthChange}
          fechaSeleccionada={fechaSeleccionada}
          turnosMes={turnosMesParaBadges}
          onDayClick={handleDayClickEnSheet}
        />
      </BottomSheet>

      {/* FAB — hidden for past dates, active filters, or while filters are open */}
      {!esFechaPasada && !hayFiltroActivo && !filtrosAbiertos && (
        <button
          onClick={() => router.push(`/agenda/nuevo?fecha=${fechaSeleccionada}`)}
          style={{
            // calc() en vez de un número fijo: suma env(safe-area-inset-bottom)
            // igual que el nav (app/(app)/layout.tsx) — sin esto el FAB queda
            // tapado por el nav en iPhones con home indicator (inset ≠ 0).
            position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primarySolid, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 20px ${withAlpha(colors.primary, '80')}`, zIndex: 45,
          }}
        >
          <Plus size={24} color={colors.primaryFg} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
