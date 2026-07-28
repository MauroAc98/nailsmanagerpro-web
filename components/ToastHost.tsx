'use client';

import React, { useEffect, useState } from 'react';
import { colors, shadows } from '@/theme/colors';
import { useToastStore } from '@/store/useToastStore';
import { NAV_HEIGHT } from '@/constants/layout';

const Z_INDEX = 90; // below ConfirmSheetHost's 100 (a confirm outranks a passing toast), above BottomSheet's 40

// Bottom-anchored pill, matching the app's card language (white, 1px border,
// soft shadow, radius 14) rather than a dark Material-style toast — every
// other floating surface in the app already reads that way. Keeps rendering
// the last message while animating out so the exit isn't an abrupt pop.
export function ToastHost() {
  const { message, toastId } = useToastStore();
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const visible = message !== null;

  useEffect(() => {
    if (message !== null) setLastMessage(message);
  }, [message, toastId]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        // Suma env(safe-area-inset-bottom) además de NAV_HEIGHT — el nav ya
        // lo hace (app/(app)/layout.tsx), y sin esto el toast queda tapado
        // por el nav en iPhones con home indicator (inset ≠ 0).
        bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 16px)`,
        zIndex: Z_INDEX,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          boxShadow: shadows.sheet,
          padding: '12px 18px',
          maxWidth: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lastMessage}
        </span>
      </div>
    </div>
  );
}
