'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';

// Mismo patrón visual que PendientesDeCobroBanner (barra fina, ícono +
// texto + acción) — oculto salvo que haya turnos de mañana sin recordatorio
// automático. No dispara su propio fetch: lee el mismo store que ya
// alimenta el ciclo de vida de la app (app/(app)/layout.tsx), que fetchea
// al montar y al volver a primer plano.
export function RecordatoriosPendientesBanner() {
  const t = useTranslations('common.RecordatoriosPendientesBanner');
  const router = useRouter();
  const { turnos, error, fetchRecordatoriosPendientes } = useRecordatoriosPendientesStore();

  // Si falló el último fetch y no hay datos previos, no hay forma de saber
  // si realmente no hay turnos o si el conteo está desactualizado — se
  // avisa en vez de quedar en silencio (que es indistinguible de "todo al día").
  if (turnos.length === 0 && !error) return null;

  const esError = error && turnos.length === 0;

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
        {esError ? t('checkError') : t('message', { count: turnos.length })}
      </span>
      <button
        onClick={() => esError ? fetchRecordatoriosPendientes() : router.push('/agenda/recordatorios')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 13, fontWeight: 700, textDecoration: 'underline',
          color: colors.amber,
        }}
      >
        {esError ? t('retry') : t('view')}
      </button>
    </div>
  );
}
