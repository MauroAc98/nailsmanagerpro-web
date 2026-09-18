'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { whatsappHelper } from '@/lib/whatsappHelper';
import { useAuthStore } from '@/store/useAuthStore';
import type { Turno } from '@/services/turnoService';
import { fechaDeHora, horaDeHora, formatFechaMini, type ProfesionalLabel } from './agendaDateHelpers';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;
// Resting/closed offset for the swipe-to-cancel cards (redesign Change 4) —
// a small sliver of the red CANCELAR panel stays visible at rest instead of
// fully hidden (translateX(0)), hinting the card is swipeable. Drag bounds
// stay [-SWIPE_REVEAL, 0] unchanged: the user can still drag all the way to
// a flush 0 if they want, this only changes where the card SETTLES.
const SWIPE_PEEK = 8;

// ─────────────────────────────────────────────
// SwipeableTurnoCard — PENDIENTE and EN_CURSO
// onCancel is optional: when omitted, the swipe-reveal cancel panel and
// touch handlers are skipped entirely. completado never reaches this
// component (rendered as FinalizadoCard instead); en_curso DOES pass
// onCancel — an auto-started turno whose client never showed up must stay
// cancellable, not just finishable.
// ─────────────────────────────────────────────
export function SwipeableTurnoCard({
  turno,
  onCancel,
  onFinalizar,
  onPress,
  profesionalLabel,
  profesionalNombreWhatsapp,
}: {
  turno:                       Turno;
  onCancel?:                   () => void;
  onFinalizar?:                () => void;
  onPress?:                    () => void;
  profesionalLabel?:           ProfesionalLabel | null;
  // Nombre de la profesional a cargo del turno, para el placeholder
  // {profesional} del mensaje de WhatsApp. A diferencia de profesionalLabel
  // (que se oculta con ≤1 profesional activa), este SIEMPRE se resuelve
  // cuando el turno tiene profesional asignada — la sustitución del mensaje
  // debe ser correcta sin importar el tamaño de la cuenta.
  profesionalNombreWhatsapp?:  string;
}) {
  const t = useTranslations('agenda.SwipeableTurnoCard');
  const user = useAuthStore(s => s.user);
  const cardRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
  // Resting/closed state is -SWIPE_PEEK, not 0 (Change 4) — see the
  // constant's comment above. Irrelevant for the !onCancel branch below:
  // that branch never attaches cardRef or reads this ref.
  const liveOffset = useRef(-SWIPE_PEEK);
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
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    // -SWIPE_PEEK (-8) is NOT < -10, so the resting peek never misfires this
    // "already open, tap to close" branch. Closing now snaps back to
    // -SWIPE_PEEK (not 0) — the peek is the resting/closed state everywhere,
    // dragging to a flush 0 is still possible but isn't where a tap-to-close
    // should leave the card (Change 4).
    if (liveOffset.current < -10) { snapTo(-SWIPE_PEEK); return; }
    onPress?.();
  };

  const isEnCurso = turno.estado_visual === 'en_curso';
  // El mockup no tiñe la card entera en_curso — el fondo siempre es
  // colors.surface, sólo el badge chiquito lleva el color de estado.
  const cardBg = colors.surface;

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
      <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 18, color: colors.textStrong, letterSpacing: 0 }}>
        {horaDeHora(turno.fecha_hora)}
      </span>
      <span style={{ fontSize: 9, fontWeight: 700, color: colors.muted, marginTop: 2, textTransform: 'uppercase' }}>
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
      {/* En curso (Change 5) — antes vivía como badge en la columna de
          acción (más alta que la de un turno pendiente, rompiendo la
          paridad de altura entre cards); ahora es una tercera línea acá,
          mismo patrón que profesionalLabel arriba. Va DESPUÉS del label de
          profesional cuando ambos aplican (multi-agenda + en_curso), la
          columna de 70px tiene lugar de sobra para las 3-4 líneas. */}
      {isEnCurso && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <span style={{ width: 5, height: 5, borderRadius: 2.5, flexShrink: 0, backgroundColor: colors.amber }} />
          <span style={{ fontSize: 8, fontWeight: 700, color: colors.amberFg, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
            {t('inProgress')}
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
          del alignItems del padre para centrarse. */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{
          fontSize: 16, fontWeight: 600, color: colors.text, margin: 0, minWidth: 0,
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

      {/* Sección acción — en_curso ahora muestra SOLO el botón de finalizar;
          el badge "EN CURSO" se mudó a la columna de hora (Change 5) para
          que esta card mida lo mismo que una pendiente (antes el badge
          apilado arriba del botón la hacía más alta). */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, flexShrink: 0 }}>
        {isEnCurso ? (
          onFinalizar && (
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
                fontSize: 11, fontWeight: 600, color: colors.primaryFg,
                border: 'none', borderRadius: 20,
                padding: '6px 14px', backgroundColor: colors.primarySolid, cursor: 'pointer',
              }}
            >
              {t('finishNow')}
            </button>
          )
        ) : (
          <>
            {turno.cliente?.telefono && (
              <a
                href={whatsappHelper.buildUrl({
                  clienteNombre:   turno.cliente.nombre,
                  clienteTelefono: turno.cliente.telefono,
                  servicio:        turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + '),
                  fecha:           fechaDeHora(turno.fecha_hora),
                  hora:            horaDeHora(turno.fecha_hora),
                  tipo:            'recordatorio',
                  negocio:         user?.name ?? '',
                  direccion:       user?.direccion ?? null,
                  telefonoNegocio: user?.telefono ?? null,
                  profesional:     profesionalNombreWhatsapp,
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={colors.whatsapp}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            )}
            <ChevronRight size={20} color={colors.border} strokeWidth={2} style={{ marginLeft: 4 }} />
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
    borderRadius: 18,
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
            // Mismo patrón que ServicioCard/GastoCard (fondo dangerBg + ícono/
            // texto en danger) en vez del rojo sólido del mockup — agenda sale
            // sola a producción por ahora, así que este swipe-to-delete se
            // mantiene visualmente unificado con el resto de la app.
            backgroundColor: colors.dangerBg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            cursor: 'pointer',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.danger, letterSpacing: 0.5 }}>
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
          // paddingLeft: compensa los px que el peek recorta del lado izquierdo.
          style={{ ...restStyle, position: 'absolute', inset: 0, right: -1, paddingLeft: SWIPE_PEEK, transform: `translateX(${-SWIPE_PEEK}px)` }}
        >
          {restBody}
        </div>
      </div>
    </div>
  );
}
