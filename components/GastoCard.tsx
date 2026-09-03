'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { Gasto } from '@/services/gastoService';
import { labelCategoriaGasto } from '@/lib/categoriaLabel';
import { formatMonto } from '@/lib/money';

// Mismos valores que ServicioCard/SwipeableTurnoCard — mismo gesto, mismo
// feel. Design (Open Question) acepta esta duplicación: no hay un
// `useSwipeToDelete` compartido todavía, extraerlo queda para un follow-up.
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;

// Mismo shape que ProfesionalLabel en agenda/page.tsx (SwipeableTurnoCard) —
// dot de color + nombre, oculto cuando el gasto no tiene profesional_id.
interface ProfesionalLabel {
  nombre: string;
  color:  string;
}

interface Props {
  gasto: Gasto;
  profesionalLabel?: ProfesionalLabel | null;
  onEdit:   () => void;
  onDelete: () => void;
}

// "YYYY-MM-DD" -> "DD/MM", igual criterio que los labels cortos del
// gráfico de Estadísticas — la card ya vive dentro de una lista acotada a
// un mes, así que el año es redundante acá.
function formatFechaCorta(fecha: string): string {
  const [, mm, dd] = fecha.split('-');
  return `${dd}/${mm}`;
}

export default function GastoCard({ gasto, profesionalLabel, onEdit, onDelete }: Props) {
  const t = useTranslations('configuracion.GastosPage');

  // Swipe-to-delete — misma técnica que ServicioCard/SwipeableTurnoCard: sin
  // estado de React para el offset, mutación directa de style.transform vía
  // refs (nada de setState por frame) para que el drag se sienta 1:1 con el
  // dedo.
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
    onEdit();
  };

  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 14,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        backgroundColor: colors.surface,
      }}
    >
      {/* Panel de eliminar — detrás, se revela con el swipe. */}
      <div
        onClick={onDelete}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', justifyContent: 'flex-end',
        }}
      >
        <div style={{
          width: SWIPE_REVEAL, height: '100%',
          backgroundColor: colors.dangerBg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger, letterSpacing: 0.5 }}>
            {t('delete')}
          </span>
        </div>
      </div>

      {/* Foreground deslizable — todo el contenido de la card. */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        style={{
          position: 'relative', transform: 'translateX(0)',
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: colors.surface,
          padding: '14px 16px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 36, height: 36,
          backgroundColor: colors.dangerBg,
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
        </div>

        {/* minWidth: 0 — sin esto un flex item con hijos de ancho de
            contenido (los spans con ellipsis de abajo) no se achica por
            debajo de ese ancho y el ellipsis nunca dispara (mismo gotcha
            documentado en agenda/page.tsx::SwipeableTurnoCard). */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>
            ${formatMonto(Number(gasto.monto))}
            <span style={{ fontSize: 12, fontWeight: 400, color: colors.subtext }}>
              {'  ·  '}{labelCategoriaGasto(gasto.categoria, t)}
            </span>
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 12, color: colors.subtext,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {formatFechaCorta(gasto.fecha)}
            {gasto.descripcion ? `  ·  ${gasto.descripcion}` : ''}
          </p>
          {profesionalLabel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <span style={{
                width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                backgroundColor: profesionalLabel.color,
              }} />
              <span style={{
                fontSize: 11, color: colors.subtext,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profesionalLabel.nombre}
              </span>
            </span>
          )}
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}
