'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { Spinner } from '@/components/Spinner';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { agendaColors, agendaShadows } from '@/theme/agendaColors';
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

const SNAP_POINTS = [0.85];

const filaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 44,
  padding: '10px 8px',
  borderRadius: 10,
  cursor: 'pointer',
  textAlign: 'left',
  background: 'none',
  border: 'none',
};

function Radio({ elegido }: { elegido: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        boxSizing: 'border-box',
        border: `2px solid ${elegido ? agendaColors.primarySolid : agendaColors.divider}`,
        backgroundColor: agendaColors.surface,
      }}
    >
      {elegido && <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: agendaColors.primarySolid }} />}
    </span>
  );
}

function Fila({ elegido, negrita, onClick, children }: { elegido: boolean; negrita: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="radio" aria-checked={elegido} onClick={onClick} style={filaStyle}>
      <Radio elegido={elegido} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: negrita ? 600 : 400,
          color: agendaColors.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {children}
      </span>
    </button>
  );
}

function Contenido({ seleccionado, onElegir, onCerrar }: Omit<Props, 'abierto' | 'zIndex'>) {
  const t = useTranslations('profesionales.Filtros');
  const servicios = useProServicios();
  const opciones = servicios.data?.servicios ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('servicio')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCerrar();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px 24px', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 16, fontWeight: 700, color: agendaColors.textStrong }}>{t('servicio')}</h2>
        <button
          type="button"
          onClick={onCerrar}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: agendaColors.primaryDeep,
          }}
        >
          {t('cerrar')}
        </button>
      </div>

      {servicios.data === null && servicios.error === null && <Spinner label={t('cargandoServicios')} />}
      {servicios.error !== null && servicios.data === null && (
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
      )}
      {servicios.data !== null && (
        <div
          role="radiogroup"
          aria-label={t('servicio')}
          style={{
            padding: '4px 8px 8px',
            borderRadius: 16,
            border: `1px solid ${agendaColors.border}`,
            backgroundColor: agendaColors.surface,
            boxShadow: agendaShadows.card,
          }}
        >
          <Fila elegido={seleccionado === null} negrita onClick={() => onElegir(null)}>
            {t('todos')}
          </Fila>
          {opciones.map((s) => (
            <Fila key={s.id} elegido={seleccionado === s.id} negrita={false} onClick={() => onElegir(s.id)}>
              {s.nombre}
            </Fila>
          ))}
        </div>
      )}
    </div>
  );
}

// Hoja de selección de servicio del portal: "Todos" arriba y un servicio por fila,
// con el elegido marcado. Selección única: quien la usa decide qué hacer al elegir
// (la hoja de filtros la cierra). Se monta como hermana de la hoja de filtros, no
// dentro de ella: el BottomSheet usa transform y atraparía un position: fixed.
export function ServicioFiltroSheet({ abierto, seleccionado, onElegir, onCerrar, zIndex = 60 }: Props) {
  if (!abierto) return null;
  return (
    <>
      <div
        data-testid="fondo-servicio"
        aria-hidden="true"
        onClick={onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: zIndex - 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      />
      <BottomSheet
        snapPoints={SNAP_POINTS}
        initialIndex={0}
        enablePanDownToClose
        onChange={(indice) => {
          if (indice < 0) onCerrar();
        }}
        handleColor={agendaColors.border}
        backgroundColor={agendaColors.surface}
        zIndex={zIndex}
      >
        <Contenido seleccionado={seleccionado} onElegir={onElegir} onCerrar={onCerrar} />
      </BottomSheet>
    </>
  );
}
