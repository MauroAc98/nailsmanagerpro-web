'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

// Design D5 — graceful, coalesced session-end UX.
//
// Mounted once in `ProvidersInner` next to the other Hosts so it survives route
// changes. While `authStatus === 'session-ending'` it renders a scrim over the
// still-mounted last screen (the guard returns `allow` for every route in that
// state) with a single dismiss action. After ~3s — or immediately on
// "Entendido" — it calls `finalizeSessionEnd()` (clears the rest of the auth
// state + storage, LOGOUT-transitions the machine) and navigates to the
// returned `/login?redirect=<origin>` target.
const AUTO_DISMISS_MS = 3000;
// Above ConfirmSheetHost (100) so a confirm opened mid-action can't sit on top.
const Z_INDEX = 150;

export function SessionEndedModal() {
  const router = useRouter();
  const t = useTranslations('common.SessionEndedModal');
  const visible = useAuthStore(s => s.authStatus === 'session-ending');

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const to = useAuthStore.getState().finalizeSessionEnd();
      router.replace(to);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, router]);

  if (!visible) return null;

  const finalizeNow = () => {
    const to = useAuthStore.getState().finalizeSessionEnd();
    router.replace(to);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t('title')}
        style={{
          position: 'relative',
          maxWidth: 320,
          margin: '0 20px',
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: '28px 24px calc(24px + env(safe-area-inset-bottom))',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: '0 0 10px' }}>
          {t('title')}
        </h2>
        <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.5, margin: '0 0 20px' }}>
          {t('body')}
        </p>
        <button
          onClick={finalizeNow}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 12,
            border: 'none',
            backgroundColor: colors.primarySolid,
            color: '#FFF',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
}
