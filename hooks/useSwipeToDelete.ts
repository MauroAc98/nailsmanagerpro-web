import React, { useRef } from 'react';

// Mismos valores que GastoCard/ServicioCard/SwipeableTurnoCard — mismo gesto,
// mismo feel.
export const SWIPE_REVEAL    = 80;
export const SWIPE_THRESHOLD = 55;
// Resting/closed offset: un sliver del panel de eliminar queda visible en
// reposo en vez de translateX(0). La capa se desplaza -SWIPE_PEEK y el borde
// de la card recorta esos px: el padding izquierdo debe sumar SWIPE_PEEK.
export const SWIPE_PEEK      = 8;

interface Options {
  // Se ejecuta al tocar la card cuando el panel está cerrado (no tras un drag).
  onTap?: () => void;
}

// Swipe-to-delete sin estado de React para el offset: mutación directa de
// style.transform vía refs (nada de setState por frame) para que el drag se
// sienta 1:1 con el dedo. El consumidor aplica `cardRef` + `handlers` al
// foreground deslizable y renderiza el panel de eliminar detrás.
export function useSwipeToDelete({ onTap }: Options = {}) {
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

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current     = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current    = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const onTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
  };

  const onClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(-SWIPE_PEEK); return; }
    onTap?.();
  };

  return { cardRef, handlers: { onTouchStart, onTouchMove, onTouchEnd, onClick } };
}
