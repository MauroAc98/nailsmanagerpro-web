'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { turnoService, Turno, TurnoMes } from '@/services/turnoService';
import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { whatsappHelper } from '@/lib/whatsappHelper';
import { SubscriptionWarningBanner } from '@/components/SubscriptionWarningBanner';
import { PendientesDeCobroBanner } from '@/components/PendientesDeCobroBanner';
import { RecordatoriosPendientesBanner } from '@/components/RecordatoriosPendientesBanner';
import { ResumenMesCard } from '@/components/agenda/ResumenMesCard';
import { alertDialog } from '@/store/useConfirmStore';
import { pedirMotivoCancelacion } from '@/store/useMotivoCancelacionStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { NAV_HEIGHT } from '@/constants/layout';
import { nombreDia, nombreMes, diasSemanaCortos } from '@/lib/dateFormat';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fechaDeHora(fechaHora: string): string {
  return fechaHora.slice(0, 10); // "YYYY-MM-DD"
}

function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "HH:MM"
}

function formatFechaMini(fechaHora: string): string {
  const dateStr = fechaDeHora(fechaHora);
  const parts   = dateStr.split('-');
  const mm      = parts[1];
  const dd      = parts[2];
  const d       = new Date(dateStr + 'T00:00:00');
  return `${nombreDia(d, 'short')} ${dd}/${mm}`;
}

function formatCellDate(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
// SwipeableTurnoCard — PENDIENTE and EN_CURSO
// onCancel is optional: when omitted, the swipe-reveal cancel panel and
// touch handlers are skipped entirely. completado never reaches this
// component (rendered as FinalizadoCard instead); en_curso DOES pass
// onCancel — an auto-started turno whose client never showed up must stay
// cancellable, not just finishable.
// ─────────────────────────────────────────────
// Multi-agenda — nombre + color de la profesional a cargo, para la tercera
// línea de timeSection. undefined/null = no se muestra (cuenta con ≤1
// profesional activa, o la vista ya está filtrada a una sola).
interface ProfesionalLabel {
  nombre: string;
  color:  string;
}

function SwipeableTurnoCard({
  turno,
  onCancel,
  onFinalizar,
  onPress,
  plantillaWhatsapp,
  profesionalLabel,
  profesionalNombreWhatsapp,
}: {
  turno:                       Turno;
  onCancel?:                   () => void;
  onFinalizar?:                () => void;
  onPress?:                    () => void;
  plantillaWhatsapp:           string;
  profesionalLabel?:           ProfesionalLabel | null;
  // Nombre de la profesional a cargo del turno, para el placeholder
  // {profesional} del mensaje de WhatsApp. A diferencia de profesionalLabel
  // (que se oculta con ≤1 profesional activa), este SIEMPRE se resuelve
  // cuando el turno tiene profesional asignada — la sustitución del mensaje
  // debe ser correcta sin importar el tamaño de la cuenta.
  profesionalNombreWhatsapp?:  string;
}) {
  const t = useTranslations('agenda.SwipeableTurnoCard');
  const cardRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
  const liveOffset = useRef(0);
  const dragged    = useRef(false);

  const applyTransform = (offset: number, animate: boolean) => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    cardRef.current.style.transform = `translateX(${offset}px)`;
  };

  const snapTo = (target: number) => {
    liveOffset.current = target;
    applyTransform(target, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current     = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current    = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta   = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : 0);
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(0); return; }
    onPress?.();
  };

  const isEnCurso = turno.estado_visual === 'en_curso';
  const cardBg = isEnCurso ? colors.amberBg : colors.surface;

  // Sección hora — ancho fijo, nunca se desliza. Si el swipe moviera esta
  // columna (junto con el resto del card) el overflow:hidden del wrapper la
  // clipearía apenas se revela el panel de cancelar (SWIPE_REVEAL ~ su ancho).
  const timeSection = (
    <div
      onClick={() => onPress?.()}
      style={{
        width: 70, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
        flexShrink: 0, backgroundColor: cardBg, cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 700, color: colors.primary, letterSpacing: -0.5 }}>
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
  );

  const restStyle: React.CSSProperties = {
    backgroundColor: cardBg,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    paddingRight: 16, // matches RN's outer card padding — the CANCELAR panel (a
                      // sibling, not part of this element) still reaches the
                      // true right edge when revealed, since only this
                      // sliding foreground gets inset, not the region behind it.
    // minWidth: 0 — needed for the !onCancel branch below, where this element
    // is a plain `flex: 1` child (not absolutely positioned like the onCancel
    // branch's inset:0 sliding layer, which already gets a definite width from
    // its positioned parent regardless of minWidth). Without it, a flex item's
    // default min-width is 'auto': the browser refuses to shrink it below the
    // client name's full nowrap width, so the inner ellipsis never triggers
    // for long names on en_curso cards.
    minWidth: 0,
  };

  const restBody = (
    <>
      {/* Sección info central — flex column propio, no depende únicamente
          del alignItems del padre para centrarse (el padre puede crecer más
          alto que este bloque, ej. en_curso con el badge+botón apilados). */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{
          fontSize: 16, fontWeight: 600, color: colors.text, margin: '0 0 2px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {turno.cliente ? `${turno.cliente.nombre} ${turno.cliente.apellido}` : t('deletedClient')}
        </p>
        <p style={{
          fontSize: 13, color: colors.subtext, fontStyle: 'italic', margin: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + ')}
        </p>
      </div>

      {/* Sección acción */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, flexShrink: 0 }}>
        {isEnCurso ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: colors.amber, letterSpacing: 0.8,
              backgroundColor: withAlpha(colors.amber, '26'),
              border: `1px solid ${withAlpha(colors.amber, '80')}`,
              borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
            }}>
              {t('inProgress')}
            </span>
            {onFinalizar && (
              <button
                onClick={e => { e.stopPropagation(); onFinalizar(); }}
                // El botón vive dentro del área con los handlers de swipe
                // (onTouchStart/Move/End en cardRef, más abajo). stopPropagation
                // en onClick no alcanza — los eventos táctiles burbujean antes
                // y de forma independiente del click, así que un tap con
                // apenas unos px de deriva podía marcar dragged.current=true
                // en el padre y hacer que el navegador cancele el click
                // sintético del botón (el panel de precios nunca se abría).
                onTouchStart={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
                style={{
                  fontSize: 10, fontWeight: 600, color: colors.primary,
                  border: `1px solid ${colors.primary}`, borderRadius: 12,
                  padding: '4px 10px', marginTop: 4, backgroundColor: 'transparent', cursor: 'pointer',
                }}
              >
                {t('finishNow')}
              </button>
            )}
          </div>
        ) : (
          <>
            {turno.cliente?.telefono && (
              <a
                href={whatsappHelper.buildUrl({
                  clienteNombre:   turno.cliente.nombre,
                  clienteApellido: turno.cliente.apellido,
                  clienteTelefono: turno.cliente.telefono,
                  servicio:        turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + '),
                  fecha:           fechaDeHora(turno.fecha_hora),
                  hora:            horaDeHora(turno.fecha_hora),
                  plantilla:       plantillaWhatsapp,
                  profesional:     profesionalNombreWhatsapp,
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.border} strokeWidth="2" style={{ marginLeft: 4 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </>
        )}
      </div>
    </>
  );

  const outerStyle: React.CSSProperties = {
    display: 'flex',
    // default alignItems (stretch) on purpose: both timeSection and the
    // sliding region need to stretch to the row's full height — the sliding
    // region's CANCELAR panel is top:0/bottom:0 within it, so it must span
    // the whole row, not just its own content's natural height.
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.card,
    overflow: 'hidden',
    backgroundColor: cardBg, // el paddingLeft de abajo queda fuera de timeSection/
                             // restStyle (los que pintan cardBg) — sin esto, ese
                             // hueco se ve blanco en vez del color real de la card.
    minHeight: 75,
    paddingLeft: 16, // matches RN's CardContainer/globalStyles.card outer padding
  };

  if (!onCancel) {
    return (
      <div style={outerStyle}>
        {timeSection}
        <div onClick={() => onPress?.()} style={{ ...restStyle, flex: 1 }}>
          {restBody}
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      {timeSection}

      {/* Región deslizable — un "viewport" (relative+overflow:hidden) con dos
          capas que llenan su caja entera por posición absoluta (top/left/
          right/bottom:0), igual técnica para las dos. Nada de flex-basis ni
          anchos porcentuales acá: eso fue lo que rompía cosas distintas cada
          vez que se tocaba algo — con fill absoluto no hay ambigüedad. */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* CANCELAR panel behind — llena toda la región */}
        <div
          onClick={onCancel}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <div style={{
            width: SWIPE_REVEAL, height: '100%',
            backgroundColor: colors.dangerAccent,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            cursor: 'pointer',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: colors.danger, letterSpacing: 0.5 }}>
              {t('cancel')}
            </span>
          </div>
        </div>

        {/* Foreground deslizable — también llena toda la región */}
        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCardClick}
          style={{ ...restStyle, position: 'absolute', inset: 0, right: -1, transform: 'translateX(0)' }}
        >
          {restBody}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FinalizadoCard — opacity 0.6, no swipe
// ─────────────────────────────────────────────
function FinalizadoCard({ turno, profesionalLabel }: { turno: Turno; profesionalLabel?: ProfesionalLabel | null }) {
  const t = useTranslations('agenda.FinalizadoCard');
  return (
    <div style={{ opacity: 0.6 }}>
      <div style={{
        backgroundColor: colors.surfaceSubtle, borderRadius: 14,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        padding: '12px 26px 12px 16px', display: 'flex', alignItems: 'center', minHeight: 75,
      }}>
        {/* Sección hora */}
        <div style={{
          width: 70, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: colors.muted, letterSpacing: -0.5 }}>
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
            fontSize: 16, fontWeight: 600, color: colors.muted, margin: '0 0 2px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {turno.cliente ? `${turno.cliente.nombre} ${turno.cliente.apellido}` : t('deletedClient')}
          </p>
          <p style={{
            fontSize: 13, color: colors.subtext, fontStyle: 'italic', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + ')}
          </p>
        </div>

        {/* Sección acción */}
        <div style={{ paddingLeft: 10, paddingRight: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: colors.primary, letterSpacing: 0.8,
            backgroundColor: withAlpha(colors.primary, '26'),
            border: `1px solid ${withAlpha(colors.primary, '66')}`,
            borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
          }}>
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
        <span style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
          {titulo}
        </span>

        <button
          onClick={onAbrirFiltros}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${colors.primary}`,
            backgroundColor: hayFiltroActivo ? colors.primary : 'transparent',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hayFiltroActivo ? '#FFF' : colors.primary} strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: hayFiltroActivo ? '#FFF' : colors.primary }}>
            {hayFiltroActivo ? t('activeFilters') : t('filter')}
          </span>
        </button>
      </div>

      {cargando && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div
            className="loader-spinner"
            style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${colors.border}`, borderTopColor: colors.primary }}
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

  const fecha = `${anioStr}-${mesStr.padStart(2, '0')}-${diaStr.padStart(2, '0')}`;
  const d = new Date(fecha);
  if (isNaN(d.getTime()))       return null;
  if (d.getMonth() + 1 !== mes) return null;

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
  onToggleServicio,
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
  onToggleServicio: (id: number) => void;
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
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: colors.primary }}
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" style={{ marginRight: 8, flexShrink: 0 }}>
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fechaError ? colors.dangerBorder : fechaFiltro ? colors.primary : colors.muted} strokeWidth="2" style={{ marginRight: 8, flexShrink: 0 }}>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fechaError ? colors.dangerBorder : colors.primary} strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </button>
        )}
      </div>
      {fechaError && (
        <p style={{ fontSize: 11, color: colors.danger, marginTop: 5, marginLeft: 2 }}>{t('invalidDate')}</p>
      )}

      {/* Filtrar por servicio */}
      <p style={{ ...sectionLabelStyle, marginTop: fechaError ? 12 : 16 }}>
        {t('filterByService')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {serviciosActivos.map(s => (
          <button
            key={s.id}
            onClick={() => onToggleServicio(s.id)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: `1px solid ${servicioFiltro === s.id ? colors.primary : colors.divider}`,
              backgroundColor: servicioFiltro === s.id ? colors.primary : colors.surfaceSubtle,
              color: servicioFiltro === s.id ? '#FFF' : colors.textStrong,
              cursor: 'pointer',
            }}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <button
        onClick={onAplicar}
        disabled={btnDeshabilitado}
        style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          backgroundColor: btnDeshabilitado ? colors.divider : colors.primary,
          color: '#FFF', fontSize: 15, fontWeight: 600,
          cursor: btnDeshabilitado ? 'default' : 'pointer',
        }}
      >
        {t('viewResults')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// CalendarioMensual — pure JS, no library
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
  const todayStr = new Date().toISOString().split('T')[0];
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
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
    <div style={{ padding: '0 16px 12px' }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: colors.text, textTransform: 'capitalize' }}>
          {nombreMes(viewDate, 'long')} {year}
        </span>
        <button
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {diasSemanaCortos().map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: colors.muted, paddingBottom: 4 }}>
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
                backgroundColor: isSelected ? colors.primary : 'transparent',
                boxShadow: isSelected ? `0 2px 4px ${withAlpha(colors.primary, '4D')}` : 'none',
                position: 'relative',
              }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: isSelected || (isToday && !isSelected) ? 700 : 400,
                  color: isSelected
                    ? '#FFF'
                    : esPasado
                      ? colors.placeholder
                      : isToday
                        ? colors.primary
                        : colors.text,
                }}>
                  {cell.date.getDate()}
                </span>

                {/* Badge — any future day with turnos, count from turnosMes */}
                {count > 0 && !esPasado && (
                  <div style={{
                    position: 'absolute', top: -2, right: -2,
                    minWidth: 18, height: 18, borderRadius: 9, padding: '0 2px',
                    backgroundColor: isSelected ? '#FFF' : colors.primary,
                    border: `2px solid ${isSelected ? colors.primary : '#FFF'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: isSelected ? colors.primary : '#FFF' }}>
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
      display: 'flex', gap: 8,
      backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <button
        onClick={() => onSeleccionar(null)}
        style={{
          flexShrink: 0, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
          border: `1px solid ${filtroActivo === null ? colors.primary : colors.divider}`,
          backgroundColor: filtroActivo === null ? colors.primary : colors.surface,
          color: filtroActivo === null ? '#FFF' : colors.text,
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
              color: selected ? '#FFF' : colors.text,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 4, flexShrink: 0, backgroundColor: selected ? '#FFF' : color }} />
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

  const {
    turnos, turnosMes, loading,
    fechaSeleccionada, fetchTurnos, fetchTurnosMes,
    completarTurno, cancelarTurno, setFechaSeleccionada,
    turnosBusqueda, cargandoBusqueda,
    buscarPorNombre, buscarPorServicio, buscarPorFecha, limpiarBusqueda,
  } = useTurnoStore();

  const { servicios, fetchServicios } = useServiciosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { obtenerContenido } = useWhatsappTemplates();

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

  const hayFiltroActivo = !!textoBusqueda || servicioFiltro !== null || fechaFiltro !== null;
  const hoy = new Date().toISOString().split('T')[0];
  const esFechaPasada = fechaSeleccionada < hoy;

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

  // Solo profesionales con al menos un turno vigente ese día — el "Todas"
  // implícito lo agrega SelectorProfesionalDia.
  const profesionalesConTurnoHoy = useMemo(() => {
    if (!mostrarSelectorProfesional) return [];
    const ids = new Set(
      turnos
        .filter(t => t.estado !== 'cancelado' && t.profesional_id != null)
        .map(t => t.profesional_id as number)
    );
    return profesionales.filter(p => ids.has(p.id));
  }, [turnos, profesionales, mostrarSelectorProfesional]);

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
    const today = new Date().toISOString().split('T')[0];
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
      ? today.toISOString().split('T')[0]
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

  const handleBuscarCliente = useCallback((txt: string) => {
    setTextoBusqueda(txt);
    buscarPorNombre(txt);
  }, [buscarPorNombre]);

  const handleToggleServicio = useCallback((id: number) => {
    const nuevo = servicioFiltro === id ? null : id;
    setServicioFiltro(nuevo);
    buscarPorServicio(nuevo);
  }, [servicioFiltro, buscarPorServicio]);

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
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 340 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
        <button
          onClick={() => router.push(`/agenda/historia?fecha=${fechaSeleccionada}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, color: colors.primary, letterSpacing: 1,
            border: 'none', padding: '4px 0', backgroundColor: 'transparent', cursor: 'pointer',
          }}>
          {t('share')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill={colors.primary} stroke="none" />
          </svg>
        </button>
      </div>

      <SubscriptionWarningBanner />
      <PendientesDeCobroBanner />
      <RecordatoriosPendientesBanner />

      {/* Resumen del mes — vistazo rápido, detalle completo en
          Configuración → Estadísticas. Se auto-oculta sin turnos este mes. */}
      <div style={{ padding: '12px 20px 0' }}>
        <ResumenMesCard profesionalId={profesionalFiltro} viewDate={viewDate} />
      </div>

      {/* Selector de profesional — invisible con ≤1 profesional activa, o si
          nadie tiene turno vigente ese día. Solo entran acá las profesionales
          con turno en fechaSeleccionada — la etiqueta aclara de qué día,
          porque si no parece una lista fija de profesionales y no un filtro
          atado al día que estás mirando en el calendario. */}
      {mostrarSelectorProfesional && profesionalesConTurnoHoy.length > 0 && (
        <div style={{ padding: '0 20px 12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: colors.subtext }}>
            {fechaSeleccionada === hoy ? t('professionalWithAppointmentToday') : t('professionalWithAppointmentOn', { fecha: formatFechaCorta(fechaSeleccionada) })}
          </p>
          <SelectorProfesionalDia
            profesionales={profesionalesConTurnoHoy}
            filtroActivo={profesionalFiltro}
            onSeleccionar={setProfesionalFiltro}
          />
        </div>
      )}

      {/* Calendar — dimmed and disabled while a filter is active */}
      <div style={{ opacity: hayFiltroActivo ? 0.5 : 1, pointerEvents: hayFiltroActivo ? 'none' : 'auto' }}>
        <CalendarioMensual
          viewDate={viewDate}
          onMonthChange={handleMonthChange}
          fechaSeleccionada={fechaSeleccionada}
          turnosMes={turnosMesParaBadges}
          onDayClick={handleDayClick}
        />
      </div>

      {/* Main list sheet — draggable across 30/50/80% of viewport height */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={[0.3, 0.5, 0.8]}
        initialIndex={0}
        enablePanDownToClose={false}
        handleColor={colors.primary}
        bottomOffset={NAV_HEIGHT}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 40 }}>
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
                  plantillaWhatsapp={obtenerContenido('recordatorio')}
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
        bottomOffset={NAV_HEIGHT}
      >
        <FiltroSheetContent
          textoBusqueda={textoBusqueda}
          servicioFiltro={servicioFiltro}
          fechaFiltro={fechaFiltro}
          serviciosActivos={serviciosActivos}
          hayFiltroActivo={hayFiltroActivo}
          onChangeBusqueda={handleBuscarCliente}
          onLimpiarBusqueda={() => { setTextoBusqueda(''); buscarPorNombre(''); }}
          onToggleServicio={handleToggleServicio}
          onCambiarFecha={handleCambiarFecha}
          onLimpiarTodo={handleLimpiarTodo}
          onAplicar={() => filtroSheetRef.current?.close()}
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
            position: 'fixed', bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primary, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(215, 158, 164, 0.5)', zIndex: 45,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
