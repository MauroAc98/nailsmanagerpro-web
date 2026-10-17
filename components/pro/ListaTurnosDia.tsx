'use client';

import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import type { ProError } from '@/lib/pro/errores';
import { compararFechaHora, diaDe } from '@/lib/pro/fechaHora';
import type { ProListaTurnos, ProTurno } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';
import { AvisoTruncado } from './AvisoTruncado';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProTurnoCard } from './ProTurnoCard';

interface Props {
  data: ProListaTurnos | null;
  cargando: boolean;
  error: ProError | null;
  onReintentar: () => void;
  onAbrir: (id: number) => void;
  // Resultados de un rango: un encabezado por fecha, horas en orden.
  agrupar?: boolean;
  // Reemplaza el estado vacío por defecto (p. ej. "sin resultados" con acción).
  vacio?: ReactNode;
}

// "sábado, 17 de octubre": se formatea en UTC con partes numéricas del string,
// la zona del dispositivo no puede correr el día.
function etiquetaDeDia(dia: string, locale: string): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, d)),
  );
}

// Lista de turnos en orden cronológico (un día o, con `agrupar`, un rango). Si
// `truncated` es true avisa que hay más; `descartados` queda en un data-* del <ul>.
export function ListaTurnosDia({ data, cargando, error, onReintentar, onAbrir, agrupar = false, vacio }: Props) {
  const t = useTranslations('profesionales.Agenda');
  const locale = useLocale();
  // Quien atiende en el negocio activo: se muestra como "con {nombre}" en cada tarjeta.
  const profesional = useProAuthStore((s) => s.vinculos.find((v) => v.id === s.vinculoActivoId)?.profesional);
  const ordenados = useMemo(
    () => (data === null ? [] : [...data.turnos].sort((a, b) => compararFechaHora(a.fecha_hora, b.fecha_hora))),
    [data],
  );
  // Ya ordenados por fecha y hora: agrupar es cortar en cada cambio de día.
  const grupos = useMemo(() => {
    const porDia = new Map<string, ProTurno[]>();
    for (const turno of ordenados) {
      const dia = diaDe(turno.fecha_hora) ?? '';
      porDia.set(dia, [...(porDia.get(dia) ?? []), turno]);
    }
    return [...porDia.entries()].filter(([dia]) => dia !== '');
  }, [ordenados]);

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

  const lista = (turnos: ProTurno[]) => (
    <ul
      data-truncated={String(data.truncated)}
      data-descartados={String(data.descartados)}
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {turnos.map((turno) => (
        <li key={turno.id} style={{ minWidth: 0 }}>
          <ProTurnoCard turno={turno} profesional={profesional} onAbrir={onAbrir} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {bloqueError}
      <AvisoTruncado truncado={data.truncated} />
      {ordenados.length === 0 ? (
        error === null &&
        (vacio ?? (
          <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', fontSize: 15, color: agendaColors.sub }}>
            {t('vacio')}
          </p>
        ))
      ) : agrupar ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grupos.map(([dia, turnos]) => (
            <section key={dia}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, textTransform: 'capitalize', color: agendaColors.strong }}>
                {etiquetaDeDia(dia, locale)}
              </h3>
              {lista(turnos)}
            </section>
          ))}
        </div>
      ) : (
        lista(ordenados)
      )}
    </>
  );
}
