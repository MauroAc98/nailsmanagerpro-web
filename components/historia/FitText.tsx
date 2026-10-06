'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────
// FitText — shrinks font-size until the text fits on one line, instead of
// truncating with an ellipsis. Mirrors RN's `adjustsFontSizeToFit` (used on
// the "horas" row) — with ellipsis, busy days with many free slots were
// silently hiding real hours instead of just rendering them smaller.
// Compartido por la historia de turnos (StoryCanvas) y el encabezado de la
// historia de precios (EncabezadoHistoria).
// ─────────────────────────────────────────────
export function FitText({
  text, maxFontSize, minFontSize = 6, style, testId,
}: {
  text: string;
  maxFontSize: number;
  minFontSize?: number;
  style?: React.CSSProperties;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = maxFontSize;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > minFontSize) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [text, maxFontSize, minFontSize]);

  return (
    <span
      ref={ref}
      data-testid={testId}
      style={{ ...style, fontSize, whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', width: '100%' }}
    >
      {text}
    </span>
  );
}
