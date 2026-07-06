'use client';

import React, { useRef, useState } from 'react';
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
// TextoDraggable — free-text pill, plain pointer-event drag.
// Commit-on-release: live offset is local state during drag,
// only written back to the parent's array on pointer-up.
// No bounds clamping (intentional parity with RN).
//
// A corner handle drives resize independently of the move drag —
// its own pointerdown stops propagation so it never triggers a move.
// ─────────────────────────────────────────────
export function TextoDraggable({ item, onMover, onResize, onEditar }: Props) {
  const [dragging,  setDragging]  = useState(false);
  const [resizing,  setResizing]  = useState(false);
  const [pos,       setPos]       = useState({ x: item.x, y: item.y });
  const [fontSize,  setFontSize]  = useState(item.fontSize);

  const startPointer  = useRef({ px: 0, py: 0 });
  const startPos      = useRef({ x: item.x, y: item.y });
  const startFontSize = useRef(item.fontSize);
  const moved         = useRef(false);

  // No external sync needed: item.x/y/fontSize only change via our own
  // commits, and the parent unmounts/remounts this component (by id) on
  // reset — a fresh initial state from item is always correct on mount.

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startPointer.current = { px: e.clientX, py: e.clientY };
    startPos.current     = { x: pos.x, y: pos.y };
    moved.current        = false;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startPointer.current.px;
    const dy = e.clientY - startPointer.current.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onMover(item.id, pos.x, pos.y);
    // A tap (no real movement) opens the text for editing instead of moving it.
    if (!moved.current) onEditar(item.id);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startPointer.current  = { px: e.clientX, py: e.clientY };
    startFontSize.current = fontSize;
    setResizing(true);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizing) return;
    e.stopPropagation();
    const dx   = e.clientX - startPointer.current.px;
    const dy   = e.clientY - startPointer.current.py;
    const drag = (dx + dy) / 2; // diagonal drag: out = bigger, in = smaller
    const next = Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, startFontSize.current + drag / 3)));
    setFontSize(next);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizing) return;
    e.stopPropagation();
    setResizing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onResize(item.id, fontSize);
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

      {/* Resize handle — bottom-right corner, independent gesture */}
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        style={{
          position:       'absolute',
          right:          -6,
          bottom:         -6,
          width:          16,
          height:         16,
          borderRadius:   '50%',
          background:     '#fff',
          border:         '2px solid rgba(0,0,0,0.35)',
          cursor:         'nwse-resize',
          touchAction:    'none',
        }}
      />
    </div>
  );
}
