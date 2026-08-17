'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';

interface Props {
  onClick?: () => void;
}

// ─────────────────────────────────────────────
// BackButton — single shared "go back" header control for the whole app.
// ─────────────────────────────────────────────
export default function BackButton({ onClick }: Props) {
  const router = useRouter();
  const t = useTranslations('common.BackButton');

  return (
    <button
      onClick={onClick ?? (() => router.back())}
      aria-label={t('ariaLabel')}
      style={{
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
