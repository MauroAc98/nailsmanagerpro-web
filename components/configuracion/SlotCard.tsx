'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { Slot } from '@/services/slotService';
import PillToggle from '@/components/PillToggle';

// Extraído de app/(app)/configuracion/slots/page.tsx — un named export
// adicional en un archivo `page.tsx` de App Router rompe `tsc --noEmit`
// contra `.next/types/.../page.ts` (mismo motivo que la extracción de
// WeekStrip/SwipeableTurnoCard fuera de agenda/page.tsx).
const SWIPE_REVEAL    = 90;
const SWIPE_THRESHOLD = 55;
// Resting/closed offset — mismo criterio que SwipeableTurnoCard (Change 4,
// agenda): un sliver del panel de eliminar queda visible en reposo en vez de
// translateX(0), como pista de que la card se puede deslizar.
const SWIPE_PEEK = 8;

export function SlotCard({
  slot,
  onToggle,
  onDelete,
}: {
  slot: Slot;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('configuracion.SlotsPage');
  const cardRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
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
    startX.current = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
  };

  const cardBg = slot.activo ? colors.surface : colors.surfaceSubtle;

  return (
    <div style={{
      display: 'flex', borderRadius: 14, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, overflow: 'hidden',
      opacity: slot.activo ? 1 : 0.65,
    }}>
      {/* Ícono — ancho fijo, nunca se desliza (si se moviera junto con el
          resto, el overflow:hidden de la región deslizable lo clipearía). */}
      <div style={{
        width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, backgroundColor: cardBg,
      }}>
        <div style={{
          width: 36, height: 36,
          backgroundColor: slot.activo ? withAlpha(colors.primary, '15') : colors.surfaceSubtle,
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={slot.activo ? colors.primaryDeep : colors.placeholder} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      </div>

      {/* Región deslizable — info + toggle, revela ELIMINAR detrás */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          onClick={onDelete}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: SWIPE_REVEAL, backgroundColor: colors.dangerBg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger }}>{t('delete')}</span>
        </div>

        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 12,
            backgroundColor: cardBg,
            padding: '14px 16px 14px 0',
            userSelect: 'none',
            transform: `translateX(${-SWIPE_PEEK}px)`,
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: slot.activo ? colors.text : colors.placeholder }}>
              {slot.hora} hs
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {slot.activo ? t('available') : t('disabled')}
            </p>
          </div>

          <PillToggle value={slot.activo} onChange={onToggle} stopPropagation />

          {/* Mismo chevron que ServicioCard/IngresoCard/GastoCard — faltaba
              acá, dejando este card como el único con swipe-to-delete sin el
              ícono que lo acompaña en el resto de la app. */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
