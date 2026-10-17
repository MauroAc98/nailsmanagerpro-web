'use client';

import type { ReactNode, RefObject } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { NAV_CLEARANCE, NAV_MARGIN } from '@/constants/layout';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';

interface Props {
  // Fecha elegida (YYYY-MM-DD): da el título cuando no hay filtros.
  fecha: string;
  filtrando: boolean;
  cantidadActivos: number;
  botonFiltros: RefObject<HTMLButtonElement | null>;
  onFiltrar: () => void;
  children: ReactNode;
}

// Igual que la hoja de turnos de la agenda: arranca plegada y se estira hasta el 80%.
const SNAP_POINTS = [0.3, 0.5, 0.8];

// "sáb 17 de oct": se formatea en UTC con partes numéricas del string, la zona
// del dispositivo no puede correr el día.
function fechaCorta(fecha: string, locale: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, dia)),
  );
}

// Hoja con la lista de turnos (un día o los resultados de los filtros): título
// serif a la izquierda y botón "Filtrar" a la derecha. Por DETRÁS del nav a
// propósito (se extiende hasta el borde): el contenido lleva NAV_CLEARANCE para
// que el último turno no quede tapado por la barra.
export function HojaTurnosPro({ fecha, filtrando, cantidadActivos, botonFiltros, onFiltrar, children }: Props) {
  const t = useTranslations('profesionales.Agenda');
  const tFiltros = useTranslations('profesionales.Filtros');
  const locale = useLocale();
  const titulo = filtrando
    ? t('resultados')
    : fecha === hoyDelDispositivo()
      ? t('turnosHoy')
      : t('turnosDe', { fecha: fechaCorta(fecha, locale) });
  const color = filtrando ? agendaColors.primaryFg : agendaColors.text;

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      initialIndex={0}
      enablePanDownToClose={false}
      handleColor={agendaColors.border}
      backgroundColor={agendaColors.surface}
      sideInset={NAV_MARGIN}
    >
      <div data-testid="hoja-turnos" style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
          <span
            style={{ minWidth: 0, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: agendaColors.strong }}
          >
            {titulo}
          </span>
          <button
            ref={botonFiltros}
            type="button"
            aria-haspopup="dialog"
            onClick={onFiltrar}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 22,
              border: `1px solid ${filtrando ? 'transparent' : agendaColors.border}`,
              backgroundColor: filtrando ? agendaColors.primarySolid : agendaColors.surface,
              cursor: 'pointer',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color }}>
              {filtrando ? tFiltros('botonActivos', { cantidad: cantidadActivos }) : tFiltros('filtrar')}
            </span>
          </button>
        </div>
        <div style={{ paddingBottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 24px)` }}>{children}</div>
      </div>
    </BottomSheet>
  );
}
