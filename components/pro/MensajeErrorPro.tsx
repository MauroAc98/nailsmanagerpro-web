'use client';

import { useTranslations } from 'next-intl';
import type { ProError } from '@/lib/pro/errores';
import { agendaColors } from '@/theme/agendaColors';
import { useCuentaRegresiva } from './useCuentaRegresiva';

interface Props {
  error: ProError;
  id: string;
  // Cuenta ya calculada por quien también la usa (p. ej. para deshabilitar el
  // envío). Sin ella el componente lleva su propia cuenta.
  restantes?: number | null;
}

// Muestra cualquier ProError con el copy de Errores.<kind>. Nunca el `message`
// del backend. El 429 con espera conocida cuenta hacia atrás.
export function MensajeErrorPro({ error, id, restantes }: Props) {
  const t = useTranslations('profesionales.Errores');
  const propia = useCuentaRegresiva(error);
  const segundos = restantes === undefined ? propia : restantes;

  const texto =
    error.kind === 'rateLimited' && segundos !== null && segundos > 0
      ? t('rateLimitedSegundos', { segundos })
      : t(error.kind === 'rateLimited' ? 'rateLimited' : error.kind);

  return (
    <p
      id={id}
      role="alert"
      style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: agendaColors.danger, overflowWrap: 'anywhere' }}
    >
      {texto}
    </p>
  );
}
