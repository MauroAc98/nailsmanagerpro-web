'use client';

import { colors } from '@/theme/colors';

export function Loader({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="loader-spinner"
        style={{
          width: 40, height: 40, borderRadius: 20,
          border: `4px solid ${colors.border}`,
          borderTopColor: colors.primary,
        }}
      />
    </div>
  );
}
