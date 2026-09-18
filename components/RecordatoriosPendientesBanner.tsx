'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageSquareWarning, ChevronRight, X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';

// Predicado puro — ver el mismo comentario en useSubscriptionWarningVisible
// (SubscriptionWarningBanner.tsx). Única fuente de verdad de "¿aplicaría
// este banner?", consumida acá y desde app/(app)/agenda/page.tsx.
export function useRecordatoriosPendientesVisible(): boolean {
  const { turnos, error } = useRecordatoriosPendientesStore();
  return turnos.length > 0 || !!error;
}

// Solo se renderiza dentro de app/(app)/agenda/page.tsx, que ya envuelve el
// árbol en className="agenda-dark"/"agenda-light" — mismo criterio que
// PendientesDeCobroBanner (ver ese archivo). Oculto salvo que haya turnos
// de mañana sin recordatorio automático. No dispara su propio fetch: lee el
// mismo store que ya alimenta el ciclo de vida de la app
// (app/(app)/layout.tsx), que fetchea al montar y al volver a primer plano.
export function RecordatoriosPendientesBanner({ onDismiss }: { onDismiss?: () => void }) {
  const t = useTranslations('common.RecordatoriosPendientesBanner');
  const router = useRouter();
  const { turnos, error, fetchRecordatoriosPendientes } = useRecordatoriosPendientesStore();
  const visible = useRecordatoriosPendientesVisible();

  if (!visible) return null;

  const esError = error && turnos.length === 0;

  // Mismo motivo que PendientesDeCobroBanner: <div role="button"> en vez de
  // <button> para poder anidar el ícono de descarte.
  const activar = () => (esError ? fetchRecordatoriosPendientes() : router.push('/agenda/recordatorios'));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activar}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activar();
        }
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: 'calc(100% - 40px)',
        margin: '0 20px 14px', padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
        borderRadius: 18, border: `1px solid ${colors.border}`, backgroundColor: colors.amberBg,
      }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, color: colors.amberBg,
      }}>
        <MessageSquareWarning size={18} strokeWidth={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.amberFg }}>
          {t('title')}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: colors.amberFg, opacity: 0.85 }}>
          {esError ? t('checkError') : t('message', { count: turnos.length })}
        </span>
      </span>
      <ChevronRight size={16} color={colors.amberFg} style={{ flexShrink: 0, opacity: 0.7 }} />
      {onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label={t('dismiss')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0,
            color: colors.amberFg, opacity: 0.7,
          }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
