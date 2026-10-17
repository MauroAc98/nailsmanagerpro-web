'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ListaServiciosBase, ServiciosHojaBase } from '@/components/filtros/ServiciosSheetBase';
import { Spinner } from '@/components/Spinner';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { formatearDuracion } from '@/lib/duracion';
import { agruparServicios } from '@/lib/pro/agruparServicios';
import { agendaColors } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';

interface Props {
  abierto: boolean;
  // Servicio elegido; null = todos.
  seleccionado: number | null;
  onElegir: (servicioId: number | null) => void;
  onCerrar: () => void;
  // Capa de la hoja (su fondo va una por debajo). Sube cuando se abre desde otra hoja.
  zIndex?: number;
}

function Contenido({ seleccionado, onElegir }: Pick<Props, 'seleccionado' | 'onElegir'>) {
  const t = useTranslations('profesionales.Filtros');
  const servicios = useProServicios();
  const lista = servicios.data?.servicios;
  // null (ninguna categoría en la respuesta) = lista plana, como antes de que el
  // backend mandara categorías.
  const grupos = useMemo(() => (lista ? agruparServicios(lista) : null), [lista]);

  if (servicios.data === null && servicios.error === null) return <Spinner label={t('cargandoServicios')} />;

  if (servicios.data === null && servicios.error !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <MensajeErrorPro error={servicios.error} id="servicio-sheet-error" />
        <button
          type="button"
          onClick={servicios.reintentar}
          aria-describedby="servicio-sheet-error"
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
          {t('reintentarServicios')}
        </button>
      </div>
    );
  }

  if (servicios.data === null) return null;

  return (
    <ListaServiciosBase
      servicios={servicios.data.servicios}
      grupos={grupos}
      seleccionadoId={seleccionado}
      onElegir={onElegir}
      todosLabel={t('todos')}
      sinCategoriaLabel={t('sinCategoria')}
      expandLabel={t('expandirCategoria')}
      collapseLabel={t('colapsarCategoria')}
      ariaLabel={t('servicio')}
      detalle={(s) =>
        s.duracion_minutos === null ? null : (
          <span style={{ fontSize: 12, color: agendaColors.subtext, flexShrink: 0 }}>
            {formatearDuracion(s.duracion_minutos)}
          </span>
        )
      }
    />
  );
}

// Hoja de selección de servicio del portal: la misma pieza visual que usa la app
// (`ServiciosHojaBase` + `ListaServiciosBase`, con "Todos" arriba, categorías como
// encabezados y la duración a la derecha). Acá solo queda lo propio del portal: de
// dónde salen los servicios (caché de `useProServicios`: id, nombre, duración y
// categoría, sin precio) y el spinner/reintento. Sin categorías en la respuesta, la
// lista sale plana.
// Selección única: quien la usa decide qué hacer al elegir (la hoja de filtros la
// cierra). Se monta como hermana de la hoja de filtros, no dentro de ella.
export function ServicioFiltroSheet({ abierto, seleccionado, onElegir, onCerrar, zIndex = 60 }: Props) {
  const t = useTranslations('profesionales.Filtros');
  if (!abierto) return null;
  return (
    <ServiciosHojaBase
      title={t('servicio')}
      closeLabel={t('cerrar')}
      onClose={onCerrar}
      backdropZIndex={zIndex - 1}
      zIndex={zIndex}
      backdropTestId="fondo-servicio"
      accesible
    >
      <Contenido seleccionado={seleccionado} onElegir={onElegir} />
    </ServiciosHojaBase>
  );
}
