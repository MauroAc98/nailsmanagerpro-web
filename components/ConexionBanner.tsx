'use client';

import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';
import { colors } from '@/theme/colors';
import { useConexionStore } from '@/store/useConexionStore';

// Aviso fijo arriba mientras no hay conexión (o es tan mala que los pedidos
// fallan). Desaparece solo cuando un pedido vuelve a responder o el navegador
// recupera la red. Va en flujo normal (empuja el contenido, no lo tapa) y usa
// la paleta global: el layout está fuera de AgendaThemeScope, donde las
// variables --ag-* no existen.
export function ConexionBanner() {
  const t = useTranslations('common.ConexionBanner');
  const conectado = useConexionStore(s => s.conectado);
  if (conectado) return null;

  return (
    <div
      role="status"
      style={{
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 8, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.warningBg, color: colors.warningFg, borderBottom: `1px solid ${colors.border}`,
        fontSize: 13, fontWeight: 600, textAlign: 'left',
      }}
    >
      <WifiOff size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span>{t('message')}</span>
    </div>
  );
}
