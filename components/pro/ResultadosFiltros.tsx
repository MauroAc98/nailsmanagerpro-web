'use client';

import { useTranslations } from 'next-intl';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { useProTurnosRango } from '@/hooks/pro/useProTurnosRango';
import { normalizarBuscar } from '@/lib/pro/filtros';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors } from '@/theme/agendaColors';
import { ListaTurnosDia } from './ListaTurnosDia';

const botonLimpiar = {
  minHeight: 44,
  padding: '0 16px',
  border: `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: agendaColors.surface,
  color: agendaColors.strong,
} as const;

const chipStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  backgroundColor: agendaColors.primarySoft,
  color: agendaColors.primaryDeep,
} as const;

// Resultados de los filtros: filtros activos nombrados (texto, no solo color),
// la acción de limpiarlos y los turnos agrupados por fecha. Los valores ya vienen
// validados del store; sin rango se consulta el día elegido. El debounce del
// texto vive en el hook: acá no se repite.
export function ResultadosFiltros({ onAbrir }: { onAbrir: (id: number) => void }) {
  const t = useTranslations('profesionales.Filtros');
  const fecha = useProAgendaStore((s) => s.fecha);
  const filtros = useProAgendaStore((s) => s.filtros);
  const servicios = useProServicios();

  const desde = filtros.desde ?? fecha;
  const hasta = filtros.hasta ?? fecha;
  const resultado = useProTurnosRango({ desde, hasta, buscar: filtros.buscar, servicioId: filtros.servicioId });

  const texto = normalizarBuscar(filtros.buscar);
  const servicio = servicios.data?.servicios.find((s) => s.id === filtros.servicioId)?.nombre ?? null;
  const limpiar = () => useProAgendaStore.getState().limpiarFiltros();

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <ul
          aria-label={t('activos')}
          style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {texto !== '' && <li style={chipStyle}>{t('chipBuscar', { texto })}</li>}
          {filtros.servicioId !== null && servicio !== null && <li style={chipStyle}>{t('chipServicio', { servicio })}</li>}
          {filtros.desde !== null && <li style={chipStyle}>{t('chipRango', { desde, hasta })}</li>}
        </ul>
        <button type="button" onClick={limpiar} style={{ ...botonLimpiar, flexShrink: 0 }}>
          {t('limpiar')}
        </button>
      </div>
      <ListaTurnosDia
        agrupar
        data={resultado.data}
        cargando={resultado.cargando}
        error={resultado.error}
        onReintentar={resultado.reintentar}
        onAbrir={onAbrir}
        vacio={
          <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', fontSize: 15, color: agendaColors.sub }}>
            {t('sinResultados')}
          </p>
        }
      />
    </section>
  );
}
