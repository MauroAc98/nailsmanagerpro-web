'use client';

import React, { useRef, useState } from 'react';
import { TextoLibre } from '@/hooks/useGenerarHistoria';

interface Props {
  item:     TextoLibre;
  onMover:  (id: string, x: number, y: number) => void;
}

// ─────────────────────────────────────────────
// TextoDraggable — free-text pill, plain pointer-event drag.
// Commit-on-release: live offset is local state during drag,
// only written back to the parent's array on pointer-up.
// No bounds clamping (intentional parity with RN).
// ─────────────────────────────────────────────
export function TextoDraggable({ item, onMover }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pos,      setPos]      = useState({ x: item.x, y: item.y });

  const startPointer = useRef({ px: 0, py: 0 });
  const startPos     = useRef({ x: item.x, y: item.y });

  // No external sync needed: item.x/y only change via our own onMover commit,
  // and the parent unmounts/remounts this component (by id) on reset — a
  // fresh initial state from item.x/y is always correct on mount.

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startPointer.current = { px: e.clientX, py: e.clientY };
    startPos.current     = { x: pos.x, y: pos.y };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startPointer.current.px;
    const dy = e.clientY - startPointer.current.py;
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onMover(item.id, pos.x, pos.y);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position:      'absolute',
        left:           pos.x,
        top:            pos.y,
        background:    'rgba(0,0,0,0.35)',
        padding:       '6px 12px',
        borderRadius:   8,
        maxWidth:       220,
        color:          '#fff',
        fontWeight:     500,
        textAlign:      'center',
        letterSpacing:  0.3,
        fontSize:       item.fontSize,
        cursor:         dragging ? 'grabbing' : 'grab',
        touchAction:    'none',
        userSelect:     'none',
        whiteSpace:     'pre-wrap',
      }}
    >
      {item.texto}
    </div>
  );
}
