'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TextoLibre } from '@/hooks/useGenerarHistoria';

interface Props {
  item:      TextoLibre;
  onMover:   (id: string, x: number, y: number) => void;
  onResize:  (id: string, fontSize: number) => void;
  onEditar:  (id: string) => void;
}

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;

// ─────────────────────────────────────────────
// TextoDraggable — free-text pill, plain pointer-event drag + pinch-to-resize.
// Commit-on-release: live offset/size is local state during the gesture,
// only written back to the parent's array on pointer-up.
// No bounds clamping (intentional parity with RN).
//
// A second simultaneous pointer switches the gesture from move to pinch:
// the ratio between the current and initial two-finger distance scales
// fontSize, mirroring the native pinch-zoom gesture users already know.
// ─────────────────────────────────────────────
export function TextoDraggable({ item, onMover, onResize, onEditar }: Props) {
  const [dragging,  setDragging]  = useState(false);
  const [pinching,  setPinching]  = useState(false);
  const [pos,       setPos]       = useState({ x: item.x, y: item.y });
  const [fontSize,  setFontSize]  = useState(item.fontSize);

  const startPointer  = useRef({ px: 0, py: 0 });
  const startPos      = useRef({ x: item.x, y: item.y });
  const startFontSize = useRef(item.fontSize);
  const moved         = useRef(false);

  const activePointers      = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistance  = useRef(0);

  // item.x/y only ever change via our own commits, but item.fontSize can
  // also change externally (the A+/A- buttons in the list) — sync it back
  // unless a gesture on this pill currently owns the value.
  useEffect(() => {
    if (!pinching) setFontSize(item.fontSize);
  }, [item.fontSize, pinching]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      // Second finger landed — switch from move to pinch-to-resize.
      setDragging(false);
      const [a, b] = Array.from(activePointers.current.values());
      pinchStartDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
      startFontSize.current = fontSize;
      setPinching(true);
      return;
    }

    startPointer.current = { px: e.clientX, py: e.clientY };
    startPos.current     = { x: pos.x, y: pos.y };
    moved.current        = false;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinching && activePointers.current.size === 2) {
      const [a, b]  = Array.from(activePointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const scale    = distance / pinchStartDistance.current;
      const next     = Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, startFontSize.current * scale)));
      setFontSize(next);
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - startPointer.current.px;
    const dy = e.clientY - startPointer.current.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (pinching) {
      if (activePointers.current.size < 2) {
        setPinching(false);
        onResize(item.id, fontSize);
      }
      return;
    }

    if (!dragging) return;
    setDragging(false);
    onMover(item.id, pos.x, pos.y);
    // A tap (no real movement) opens the text for editing instead of moving it.
    if (!moved.current) onEditar(item.id);
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
        fontSize,
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
