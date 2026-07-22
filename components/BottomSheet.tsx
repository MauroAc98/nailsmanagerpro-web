'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { colors, shadows } from '@/theme/colors';

// ─────────────────────────────────────────────
// BottomSheet — plain pointer-event drag sheet, mirrors the subset of
// @gorhom/bottom-sheet's API the RN screens rely on (snapToIndex/close via
// ref, onChange). The sheet's own DOM height is always fixed at the tallest
// snap point; a smaller snap is achieved by translateY-ing it down inside an
// overflow:hidden wrapper of that same fixed height, so dragging only ever
// touches `transform` (compositor-only) instead of `height` (a layout
// property that would force a reflow/repaint of the whole children subtree
// on every pointermove) — same imperative-ref + transition-toggle pattern
// as SwipeableTurnoCard's applyTransform in agenda/page.tsx, only committing
// the snapped index to React state on release.
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

// bottomOffset llega como número fijo (altura del nav, sin safe area) — en
// standalone PWA sobre iPhone el nav real ocupa bottomOffset + safe area
// (mismo cálculo que paddingBottom del contenido en app/(app)/layout.tsx),
// pero ese extra es 0 en Safari normal, así que nunca se notaba ahí. Sin
// sumarlo acá, el sheet (z-index 40, sin relación con el nav) pinta encima
// de la franja superior de los botones del nav exactamente en esa medida.
function useSafeAreaBottom(): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:0;padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);

    const measure = () => setValue(parseFloat(getComputedStyle(probe).paddingBottom) || 0);
    measure();

    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      document.body.removeChild(probe);
    };
  }, []);

  return value;
}

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(
    {
      snapPoints,
      initialIndex,
      enablePanDownToClose,
      onChange,
      children,
      handleColor = colors.divider,
      backgroundColor = colors.surface,
      bottomOffset = 0,
    },
    ref,
  ) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);
    // Only pointerdowns that originate on the content wrapper go through this
    // gate (the handle always drags) — set at pointerdown based on whether
    // the sheet is collapsed/half (always drags) or fully expanded with the
    // list already scrolled to top (drag only then, otherwise let the list
    // scroll natively).
    const contentDragCandidate = useRef(false);
    // Smoothed drag velocity in px/ms (dragging up = positive), used at
    // release to distinguish a fast flick (go to the next snap point in that
    // direction) from a slow drag (snap to nearest by distance).
    const lastMove = useRef({ y: 0, t: 0 });
    const velocityRef = useRef(0);
    // Logical "visible height" in px, kept in sync with every applied
    // transform — the sheet's DOM height never changes (always maxHeight),
    // so this ref (not getBoundingClientRect) is the source of truth for
    // "how much of it is showing right now" between renders.
    const visibleHeightRef = useRef(0);

    const [viewportHeight, setViewportHeight] = useState(0);
    const safeAreaBottom = useSafeAreaBottom();
    const effectiveBottomOffset = bottomOffset + safeAreaBottom;
    const availableHeight = Math.max(0, viewportHeight - effectiveBottomOffset);
    // Resting (non-dragging) snap index — real React state so the rendered
    // transform is always correct-by-construction on any re-render, instead
    // of relying on initialIndex (stale after the first snap) plus an effect
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

    const maxHeight = snapPoints[snapPoints.length - 1] * availableHeight;

    const applyVisibleHeight = useCallback(
      (px: number, animate: boolean) => {
        const el = sheetRef.current;
        if (!el) return;
        const clamped = Math.min(maxHeight, Math.max(0, px));
        visibleHeightRef.current = clamped;
        el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
        el.style.transform = `translateY(${maxHeight - clamped}px)`;
      },
      [maxHeight],
    );

    // Keeps visibleHeightRef (and the DOM transform, via the effect below
    // re-triggering only through currentIndex/maxHeight — the JSX transform
    // is declarative already) aligned with the resting snap index whenever
    // it changes outside of a drag, e.g. after a viewport resize changes
    // maxHeight while the sheet is at rest.
    useEffect(() => {
      if (!draggingRef.current) {
        visibleHeightRef.current = heightForIndex(currentIndex);
      }
    }, [currentIndex, heightForIndex]);

    const goToIndex = useCallback(
      (index: number, animate = true) => {
        applyVisibleHeight(heightForIndex(index), animate);
        setCurrentIndex(index);
        onChange?.(index);
      },
      [applyVisibleHeight, heightForIndex, onChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        snapToIndex: (i: number) => goToIndex(i, true),
        close: () => goToIndex(-1, true),
      }),
      [goToIndex],
    );

    // Below this velocity (px/ms — ~0.5 ≈ 500px/s) a release is treated as a
    // slow drag and snaps to the nearest point by distance, same as before.
    const FLICK_VELOCITY_THRESHOLD = 0.5;

    const handlePointerDown = (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartHeight.current = visibleHeightRef.current;
      draggingRef.current = true;
      lastMove.current = { y: e.clientY, t: e.timeStamp };
      velocityRef.current = 0;
      applyVisibleHeight(dragStartHeight.current, false); // cancel any in-flight transition
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const delta = dragStartY.current - e.clientY; // dragging up = positive
      const minHeight = enablePanDownToClose ? 0 : snapPoints[0] * availableHeight;
      const next = Math.min(maxHeight, Math.max(minHeight, dragStartHeight.current + delta));
      applyVisibleHeight(next, false);

      const dt = e.timeStamp - lastMove.current.t;
      if (dt > 0) {
        const instVelocity = (lastMove.current.y - e.clientY) / dt; // up = positive
        // Exponential smoothing so one jittery sample can't dominate the
        // flick decision, while still weighting the most recent movement
        // (what a native fling gesture actually measures) over the start.
        velocityRef.current = velocityRef.current * 0.7 + instVelocity * 0.3;
      }
      lastMove.current = { y: e.clientY, t: e.timeStamp };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const allIndices = enablePanDownToClose ? [-1, ...snapPoints.map((_, i) => i)] : snapPoints.map((_, i) => i);
      const velocity = velocityRef.current;

      if (Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD) {
        // Fast flick: go to the next snap point in that direction from
        // wherever the sheet was resting before this drag, regardless of
        // how far it actually got dragged — this is what makes a quick
        // upward swipe "fly" to the next point instead of falling back to
        // its start, the same way a native sheet responds to a fling.
        const direction = velocity > 0 ? 1 : -1; // up = positive = toward a taller index
        const fromPos = allIndices.indexOf(currentIndex);
        const target = allIndices[Math.min(allIndices.length - 1, Math.max(0, fromPos + direction))];
        goToIndex(target, true);
        return;
      }

      const currentHeight = visibleHeightRef.current;
      const candidates = allIndices.map((index) => ({ index, px: index < 0 ? 0 : snapPoints[index] * availableHeight }));

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

    const isExpanded = currentIndex === snapPoints.length - 1;

    // The content wrapper only ever originates a sheet-drag in two cases:
    // the sheet isn't fully expanded yet (its "peek" content isn't meant to
    // scroll independently), or it IS expanded but the list is already
    // scrolled to the top (the standard pull-at-top-to-collapse handoff).
    // Any other touch on the content area is left alone for native scrolling.
    const handleContentPointerDown = (e: React.PointerEvent) => {
      const atTop = (contentRef.current?.scrollTop ?? 0) <= 0;
      if (!isExpanded || atTop) {
        contentDragCandidate.current = true;
        handlePointerDown(e);
      } else {
        contentDragCandidate.current = false;
      }
    };

    const handleContentPointerMove = (e: React.PointerEvent) => {
      if (!contentDragCandidate.current) return;
      handlePointerMove(e);
    };

    const handleContentPointerUp = (e: React.PointerEvent) => {
      if (!contentDragCandidate.current) return;
      contentDragCandidate.current = false;
      handlePointerUp(e);
    };

    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: effectiveBottomOffset,
          zIndex: Z_INDEX,
          height: maxHeight,
          overflow: 'hidden',
          // Only the actual sheet (below) should capture clicks — the empty
          // space above it within this fixed-height clipping box must let
          // clicks fall through to whatever is underneath, same as when the
          // old height-driven div simply had zero size there.
          pointerEvents: 'none',
        }}
      >
        <div
          ref={sheetRef}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: maxHeight,
            backgroundColor,
            borderRadius: '20px 20px 0 0',
            boxShadow: shadows.sheet,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${maxHeight - heightForIndex(currentIndex)}px)`,
            pointerEvents: 'auto',
            willChange: 'transform',
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
          <div
            ref={contentRef}
            onPointerDown={handleContentPointerDown}
            onPointerMove={handleContentPointerMove}
            onPointerUp={handleContentPointerUp}
            style={{
              flex: 1,
              overflowY: isExpanded ? 'auto' : 'hidden',
              minHeight: 0,
              touchAction: isExpanded ? 'auto' : 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);
