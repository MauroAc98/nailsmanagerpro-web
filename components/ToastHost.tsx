'use client';

import React, { useEffect, useState } from 'react';
import { colors, shadows } from '@/theme/colors';
import { useToastStore } from '@/store/useToastStore';

const Z_INDEX = 90; // below ConfirmSheetHost's 100 (a confirm outranks a passing toast), above BottomSheet's 40
const NAV_HEIGHT = 78; // must match the bottom tab bar height in app/(app)/layout.tsx

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
        bottom: NAV_HEIGHT + 16,
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
