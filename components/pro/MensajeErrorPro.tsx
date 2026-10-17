'use client';

import { useTranslations } from 'next-intl';
import type { ProError } from '@/lib/pro/errores';
import { agendaColors } from '@/theme/agendaColors';
import { useCuentaRegresiva } from './useCuentaRegresiva';

interface Props {
  error: ProError;
  id: string;
  // Cuenta ya calculada por quien también la usa (p. ej. para deshabilitar el
  // envío). Si llega, este componente NO arranca su propio temporizador.
  restantes?: number | null;
}

// Muestra cualquier ProError con el copy de Errores.<kind>. Nunca el `message`
// del backend. El texto del alert es estático; la cuenta regresiva del 429 va
// en un span aria-live="off" para que el lector de pantalla no la lea cada segundo.
export function MensajeErrorPro({ error, id, restantes }: Props) {
  const t = useTranslations('profesionales.Errores');
  const propia = useCuentaRegresiva(restantes === undefined ? error : null);
  const segundos = restantes === undefined ? propia : restantes;

  return (
    <p
      id={id}
      role="alert"
      style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: agendaColors.danger, overflowWrap: 'anywhere' }}
    >
      {t(error.kind)}
      {error.kind === 'rateLimited' && segundos !== null && segundos > 0 && (
        <>
          {' '}
          <span aria-live="off">{t('esperaSegundos', { segundos })}</span>
        </>
      )}
    </p>
  );
}
