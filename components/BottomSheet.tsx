'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// ─────────────────────────────────────────────
// BottomSheet — plain pointer-event drag sheet, mirrors the subset of
// @gorhom/bottom-sheet's API the RN screens rely on (snapToIndex/close via
// ref, onChange). Height is driven by snapPoints (fractions of viewport
// height) and dragged via direct DOM style writes (same imperative-ref +
// transition-toggle pattern as SwipeableTurnoCard in agenda/page.tsx), only
// committing the snapped index to React state on release.
// ─────────────────────────────────────────────

export interface BottomSheetHandle {
  snapToIndex: (index: number) => void;
  close: () => void;
}

interface BottomSheetProps {
  snapPoints: number[];
  initialIndex: number;
  enablePanDownToClose: boolean;
  onChange?: (index: number) => void;
  children: React.ReactNode;
  handleColor?: string;
  backgroundColor?: string;
  // Space to reserve below the sheet (e.g. a fixed bottom tab bar) — the
  // sheet sits above it instead of covering it, and snapPoints are fractions
  // of the space ABOVE that reserved area, not the full viewport.
  bottomOffset?: number;
}

const Z_INDEX = 40;

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(
    {
      snapPoints,
      initialIndex,
      enablePanDownToClose,
      onChange,
      children,
      handleColor = '#DDD',
      backgroundColor = '#FFF',
      bottomOffset = 0,
    },
    ref,
  ) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);

    const [viewportHeight, setViewportHeight] = useState(0);
    const availableHeight = Math.max(0, viewportHeight - bottomOffset);
    // Resting (non-dragging) snap index — real React state so the rendered
    // height is always correct-by-construction on any re-render, instead of
    // relying on initialIndex (stale after the first snap) plus an effect
    // that only self-corrected because snapPoints happened to be a fresh
    // array reference every render.
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
      const update = () => setViewportHeight(window.innerHeight);
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }, []);

    const heightForIndex = useCallback(
      (index: number) => (index < 0 ? 0 : snapPoints[index] * availableHeight),
      [snapPoints, availableHeight],
    );

    const applyHeight = useCallback((px: number, animate: boolean) => {
      const el = sheetRef.current;
      if (!el) return;
      el.style.transition = animate ? 'height 0.25s ease' : 'none';
      el.style.height = `${px}px`;
    }, []);

    const goToIndex = useCallback(
      (index: number, animate = true) => {
        applyHeight(heightForIndex(index), animate);
        setCurrentIndex(index);
        onChange?.(index);
      },
      [applyHeight, heightForIndex, onChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        snapToIndex: (i: number) => goToIndex(i, true),
        close: () => goToIndex(-1, true),
      }),
      [goToIndex],
    );

    const handlePointerDown = (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartHeight.current =
        sheetRef.current?.getBoundingClientRect().height ?? heightForIndex(currentIndex);
      draggingRef.current = true;
      applyHeight(dragStartHeight.current, false); // cancel any in-flight transition
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const delta = dragStartY.current - e.clientY; // dragging up = positive
      const maxHeight = snapPoints[snapPoints.length - 1] * availableHeight;
      const minHeight = enablePanDownToClose ? 0 : snapPoints[0] * availableHeight;
      const next = Math.min(maxHeight, Math.max(minHeight, dragStartHeight.current + delta));
      applyHeight(next, false);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const currentHeight = sheetRef.current?.getBoundingClientRect().height ?? 0;
      const candidates = enablePanDownToClose
        ? [{ index: -1, px: 0 }, ...snapPoints.map((p, i) => ({ index: i, px: p * availableHeight }))]
        : snapPoints.map((p, i) => ({ index: i, px: p * availableHeight }));

      let closest = candidates[0];
      let closestDistance = Math.abs(closest.px - currentHeight);
      for (const c of candidates.slice(1)) {
        const distance = Math.abs(c.px - currentHeight);
        if (distance < closestDistance) {
          closest = c;
          closestDistance = distance;
        }
      }

      goToIndex(closest.index, true);
    };

    return (
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: bottomOffset,
          zIndex: Z_INDEX,
          height: heightForIndex(currentIndex),
          backgroundColor,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: handleColor,
              margin: '10px auto',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>
      </div>
    );
  },
);
