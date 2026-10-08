'use client';

import { useRef } from 'react';

// Swipe-to-cancel de las tarjetas de la agenda: la tarjeta se desliza hacia la
// izquierda y deja ver el panel CANCELAR que tiene detras. Misma logica y
// constantes que SwipeableTurnoCard, para que las dos se sientan igual.
export const SWIPE_REVEAL = 80;
export const SWIPE_THRESHOLD = 55;
// Reposo: una franja del panel queda a la vista (insinua que se desliza). Se puede
// arrastrar hasta 0, pero la tarjeta se asienta en -SWIPE_PEEK.
export const SWIPE_PEEK = 8;

export function useSwipeCancelar() {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const initOffset = useRef(0);
  const liveOffset = useRef(-SWIPE_PEEK);
  const dragged = useRef(false);

  const applyTransform = (offset: number, animate: boolean) => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
    cardRef.current.style.transform = `translateX(${offset}px)`;
  };

  const snapTo = (target: number) => {
    liveOffset.current = target;
    applyTransform(target, true);
  };

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
      initOffset.current = liveOffset.current;
      dragged.current = false;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const delta = e.touches[0].clientX - startX.current;
      if (Math.abs(delta) > 5) dragged.current = true;
      const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
      liveOffset.current = clamped;
      applyTransform(clamped, false);
    },
    onTouchEnd: () => {
      snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : -SWIPE_PEEK);
    },
  };

  // Envuelve el onClick de un elemento de la tarjeta: ignora el toque si fue un
  // arrastre y, con el panel abierto, lo cierra en vez de ejecutar la accion.
  const alTocar = (accion: () => void) => () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) {
      snapTo(-SWIPE_PEEK);
      return;
    }
    accion();
  };

  return { cardRef, handlers, alTocar };
}
