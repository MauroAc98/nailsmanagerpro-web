'use client';

import { Spinner } from '@/components/Spinner';

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
      {/* Paleta base: <Loader> se monta en providers.tsx, fuera del scope de Agenda. */}
      <Spinner size={40} variante="base" />
    </div>
  );
}
