'use client';

import { useTranslations } from 'next-intl';
import { agendaColors } from '@/theme/agendaColors';

// El backend corta la lista en 500 turnos y lo informa con `truncated`. Solo
// ese indicador es autoridad: exactamente 500 filas con `truncated: false` no avisa.
export function AvisoTruncado({ truncado }: { truncado: boolean }) {
  const t = useTranslations('profesionales.AvisoTruncado');
  if (!truncado) return null;
  return (
    <div
      role="status"
      style={{
        margin: '0 0 8px',
        padding: '10px 12px',
        borderRadius: 12,
        fontSize: 14,
        lineHeight: 1.4,
        border: `1px solid ${agendaColors.border}`,
        backgroundColor: agendaColors.surface,
        color: agendaColors.strong,
        overflowWrap: 'anywhere',
      }}
    >
      <strong style={{ fontWeight: 700 }}>{t('texto')}</strong> {t('sugerencia')}
    </div>
  );
}
