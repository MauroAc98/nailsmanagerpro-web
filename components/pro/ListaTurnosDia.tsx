'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import type { ProError } from '@/lib/pro/errores';
import { compararFechaHora } from '@/lib/pro/fechaHora';
import type { ProListaTurnos } from '@/lib/pro/tipos';
import { agendaColors } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProTurnoCard } from './ProTurnoCard';

interface Props {
  data: ProListaTurnos | null;
  cargando: boolean;
  error: ProError | null;
  onReintentar: () => void;
  onAbrir: (id: number) => void;
}

// Lista de los turnos de UN día, en orden cronológico. `truncated` y
// `descartados` quedan en atributos data-* del <ul>: el aviso al usuario es de
// otra rebanada, pero acá no se pierden.
export function ListaTurnosDia({ data, cargando, error, onReintentar, onAbrir }: Props) {
  const t = useTranslations('profesionales.Agenda');
  const ordenados = useMemo(
    () => (data === null ? [] : [...data.turnos].sort((a, b) => compararFechaHora(a.fecha_hora, b.fecha_hora))),
    [data],
  );

  const bloqueError = error !== null && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
      <MensajeErrorPro error={error} id="agenda-error" />
      <button
        type="button"
        onClick={onReintentar}
        aria-describedby="agenda-error"
        style={{
          minHeight: 44,
          padding: '0 16px',
          border: `1px solid ${agendaColors.fieldBorder}`,
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          backgroundColor: agendaColors.surface,
          color: agendaColors.strong,
        }}
      >
        {t('reintentar')}
      </button>
    </div>
  );

  if (data === null) {
    if (error !== null) return <>{bloqueError}</>;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spinner label={t('cargando')} />
      </div>
    );
  }

  return (
    <>
      {bloqueError}
      {ordenados.length === 0 ? (
        error === null && (
          <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', fontSize: 15, color: agendaColors.sub }}>
            {t('vacio')}
          </p>
        )
      ) : (
        <ul
          data-truncated={String(data.truncated)}
          data-descartados={String(data.descartados)}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {ordenados.map((turno) => (
            <li key={turno.id} style={{ minWidth: 0 }}>
              <ProTurnoCard turno={turno} onAbrir={onAbrir} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
