'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

// Mismos valores que ServicioCard — mismo gesto de swipe-to-delete, mismo feel.
// No se importa desde ahí a propósito: ServicioCard mezcla swipe con
// drag-and-drop de dnd-kit; esta fila es solo swipe.
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;
// Sliver del panel de eliminar visible en reposo, como pista de que la fila
// se desliza (misma convención que ServicioCard / SwipeableTurnoCard).
const SWIPE_PEEK = 8;

interface Props {
  nombre:   string;
  // Línea secundaria opcional (ej. "3 servicios"). Sin ella la fila es solo el nombre.
  detalle?: string;
  // Atenúa el detalle (ej. categoría sin servicios).
  detalleTenue?: boolean;
  onOpen:   () => void;
  onDelete: () => void;
}

// Fila de una lista de categorías (servicios y movimientos): card estándar de
// la app + chevron como pista de que se toca, y borrar deslizando. Una sola
// pieza para las dos pantallas, así no divergen.
export default function CategoriaRow({ nombre, detalle, detalleTenue = false, onOpen, onDelete }: Props) {
  const t = useTranslations('configuracion.CategoriasPage');

  // Sin estado de React para el offset: mutación directa de style.transform
  // vía ref (nada de setState por frame) para que el drag siga 1:1 al dedo.
  const capaRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
  const liveOffset = useRef(-SWIPE_PEEK);
  const dragged    = useRef(false);

  const aplicar = (offset: number, animar: boolean) => {
    if (!capaRef.current) return;
    capaRef.current.style.transition = animar
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    capaRef.current.style.transform = `translateX(${offset}px)`;
  };

  const snapTo = (target: number) => {
    liveOffset.current = target;
    aplicar(target, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current     = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current    = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    aplicar(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
  };

  const handleClick = () => {
    if (dragged.current) return;
    // Con el panel abierto, el primer toque lo cierra en vez de abrir la fila.
    if (liveOffset.current < -10) { snapTo(-SWIPE_PEEK); return; }
    onOpen();
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
      <div onClick={onDelete} style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          width: SWIPE_REVEAL, height: '100%', backgroundColor: colors.dangerBg,
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

      {/* Capa deslizable. El padding izquierdo suma SWIPE_PEEK para no perder
          margen con el desplazamiento de reposo. */}
      <div
        ref={capaRef}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          position: 'relative', transform: `translateX(${-SWIPE_PEEK}px)`,
          display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, boxSizing: 'border-box',
          backgroundColor: colors.surface, padding: `14px 14px 14px ${16 + SWIPE_PEEK}px`,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* minWidth:0 — un nombre largo se parte en líneas en vez de empujar
            el chevron fuera de la card. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3,
            overflowWrap: 'anywhere', color: colors.text,
          }}>
            {nombre}
          </p>
          {detalle && (
            <p style={{ margin: '3px 0 0', fontSize: 13, color: detalleTenue ? colors.placeholder : colors.subtext }}>
              {detalle}
            </p>
          )}
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}
