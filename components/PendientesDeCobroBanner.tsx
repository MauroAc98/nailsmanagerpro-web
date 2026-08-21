'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Wallet, ChevronRight } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';

// Solo se renderiza dentro de app/(app)/agenda/page.tsx, que ya envuelve el
// árbol en className="agenda-dark"/"agenda-light" — por eso puede leer
// agendaColors (var(--ag-*)) en vez del tema global y quedar reactivo al
// mismo toggle sin necesitar su propio wrapper de clase. Oculto salvo que
// haya turnos pendientes de cobro. No dispara su propio fetch: lee el mismo
// store que ya alimenta el badge de la nav (app/(app)/layout.tsx), que
// fetchea al montar y al volver a primer plano — evitar un segundo GET
// redundante acá.
export function PendientesDeCobroBanner() {
  const t = useTranslations('common.PendientesDeCobroBanner');
  const router = useRouter();
  const { pendientes, error, fetchPendientes } = usePendientesDeCobroStore();

  // Si falló el último fetch y no hay datos previos, no hay forma de saber
  // si realmente no hay pendientes o si el conteo está desactualizado — se
  // avisa en vez de quedar en silencio (que es indistinguible de "todo al día").
  if (pendientes.length === 0 && !error) return null;

  const esError = error && pendientes.length === 0;

  return (
    <button
      onClick={() => esError ? fetchPendientes() : router.push('/pendientes-de-cobro')}
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
    </button>
  );
}
