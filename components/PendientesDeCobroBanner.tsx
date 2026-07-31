'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';

// Mismo patrón visual que SubscriptionWarningBanner (barra fina, ícono +
// texto + acción) — oculto salvo que haya turnos pendientes de cobro. No
// dispara su propio fetch: lee el mismo store que ya alimenta el badge de
// la nav (app/(app)/layout.tsx), que fetchea al montar y al volver a
// primer plano — evitar un segundo GET redundante acá.
export function PendientesDeCobroBanner() {
  const t = useTranslations('common.PendientesDeCobroBanner');
  const router = useRouter();
  const pendientes = usePendientesDeCobroStore(state => state.pendientes);

  if (pendientes.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      backgroundColor: colors.amberBg,
    }}>
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={colors.amber} strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: colors.amber }}>
        {t('message', { count: pendientes.length })}
      </span>
      <button
        onClick={() => router.push('/pendientes-de-cobro')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 13, fontWeight: 700, textDecoration: 'underline',
          color: colors.amber,
        }}
      >
        {t('view')}
      </button>
    </div>
  );
}
