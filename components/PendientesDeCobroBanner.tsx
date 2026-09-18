'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Wallet, ChevronRight, X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';

// Predicado puro — ver el mismo comentario en useSubscriptionWarningVisible
// (SubscriptionWarningBanner.tsx). Única fuente de verdad de "¿aplicaría
// este banner?", consumida acá y desde app/(app)/agenda/page.tsx.
export function usePendientesDeCobroVisible(): boolean {
  const { pendientes, error } = usePendientesDeCobroStore();
  return pendientes.length > 0 || !!error;
}

// Solo se renderiza dentro de app/(app)/agenda/page.tsx, que ya envuelve el
// árbol en className="agenda-dark"/"agenda-light" — por eso puede leer
// agendaColors (var(--ag-*)) en vez del tema global y quedar reactivo al
// mismo toggle sin necesitar su propio wrapper de clase. Oculto salvo que
// haya turnos pendientes de cobro. No dispara su propio fetch: lee el mismo
// store que ya alimenta el badge de la nav (app/(app)/layout.tsx), que
// fetchea al montar y al volver a primer plano — evitar un segundo GET
// redundante acá.
export function PendientesDeCobroBanner({ onDismiss }: { onDismiss?: () => void }) {
  const t = useTranslations('common.PendientesDeCobroBanner');
  const router = useRouter();
  const { pendientes, error, fetchPendientes } = usePendientesDeCobroStore();
  const visible = usePendientesDeCobroVisible();

  if (!visible) return null;

  const esError = error && pendientes.length === 0;

  // `<div role="button">` en vez de `<button>`: necesitamos anidar el ícono
  // de descarte como otro elemento interactivo adentro, y un <button> no
  // puede contener otro <button> (HTML inválido, además de que el navegador
  // colapsa el evento click del hijo). Mismo comportamiento de teclado que
  // un <button> real vía onKeyDown (Enter/Espacio).
  const activar = () => (esError ? fetchPendientes() : router.push('/pendientes-de-cobro'));

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
        <Wallet size={18} strokeWidth={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.amberFg }}>
          {t('title')}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: colors.amberFg, opacity: 0.85 }}>
          {esError ? t('checkError') : t('message', { count: pendientes.length })}
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
