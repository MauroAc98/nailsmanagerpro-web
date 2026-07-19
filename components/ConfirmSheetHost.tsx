'use client';

import React from 'react';
import { colors } from '@/theme/colors';
import { useConfirmStore, resolveDialog } from '@/store/useConfirmStore';

const Z_INDEX = 100; // above BottomSheet's Z_INDEX (40) — dialogs sit on top of everything

// Bottom-anchored sheet visually consistent with components/BottomSheet.tsx
// (rounded top corners, same shadow) but without drag/snap-point machinery:
// a confirm/alert is a small fixed-height dialog, not draggable content, and
// letting it be swipe-dismissed would make destructive confirms too easy to
// blow past by accident.
export function ConfirmSheetHost() {
  const dialog = useConfirmStore(state => state.dialog);
  const visible = dialog !== null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        onClick={() => resolveDialog(false)}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FFF',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
          padding: '28px 20px calc(20px + env(safe-area-inset-bottom))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {dialog && (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, lineHeight: 1.4, margin: '0 0 20px' }}>
              {dialog.message}
            </p>

            {dialog.kind === 'confirm' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => resolveDialog(false)}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 14,
                    border: `1px solid ${colors.border}`, backgroundColor: '#FFF',
                    fontSize: 15, fontWeight: 600, color: colors.text, cursor: 'pointer',
                  }}
                >
                  {dialog.cancelText}
                </button>
                <button
                  onClick={() => resolveDialog(true)}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                    backgroundColor: dialog.danger ? colors.danger : colors.primary,
                    fontSize: 15, fontWeight: 600, color: '#FFF', cursor: 'pointer',
                  }}
                >
                  {dialog.confirmText}
                </button>
              </div>
            ) : (
              <button
                onClick={() => resolveDialog(true)}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                  backgroundColor: colors.primary,
                  fontSize: 15, fontWeight: 600, color: '#FFF', cursor: 'pointer',
                }}
              >
                {dialog.buttonText}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
