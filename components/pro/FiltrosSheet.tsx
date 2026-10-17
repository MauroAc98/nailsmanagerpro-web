'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { Spinner } from '@/components/Spinner';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { hayFiltrosActivos, normalizarBuscar, validarBuscar } from '@/lib/pro/filtros';
import { etiquetaCortaDeDia } from '@/lib/pro/mes';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  // Fecha y servicio del borrador: los eligen las hojas de calendario y de servicio,
  // que son hermanas de esta (ver FiltrosSheet), así que los maneja quien las monta.
  fecha: string | null;
  servicioId: number | null;
  onBorrarFecha: () => void;
  onAbrirCalendario: () => void;
  onAbrirServicios: () => void;
}

const SNAP_POINTS = [0.85];

// Título de sección en mayúsculas, igual que la hoja de filtros de la agenda.
const seccionStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 700,
  color: agendaColors.subtext,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const botonStyle = (primario: boolean, deshabilitado = false): CSSProperties => ({
  minHeight: 44,
  padding: '14px',
  border: primario ? 'none' : `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: deshabilitado ? 'default' : 'pointer',
  backgroundColor: deshabilitado ? agendaColors.divider : primario ? agendaColors.primarySolid : agendaColors.surface,
  color: primario ? agendaColors.primaryFg : agendaColors.strong,
});

const accionTextoStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 8px',
  border: 'none',
  background: 'none',
  fontSize: 13,
  fontWeight: 600,
  color: agendaColors.primaryDeep,
  cursor: 'pointer',
};

// Botón de fecha: con una fecha elegida el borde y el fondo pasan al color primario
// translúcido (color-mix, como el withAlpha de la agenda: el portal no importa theme/colors).
const fechaBordeActivo = `color-mix(in srgb, ${agendaColors.primary} 27%, transparent)`;
const fechaFondoActivo = `color-mix(in srgb, ${agendaColors.primary} 7%, transparent)`;

// Íconos en línea (el portal no usa lucide-react).
const trazo = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function IconoBuscar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...trazo} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconoCerrar({ tam }: { tam: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" strokeWidth="2" {...trazo} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconoCalendario({ activo }: { activo: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      strokeWidth="2"
      {...trazo}
      aria-hidden="true"
      style={{ marginRight: 8, flexShrink: 0, color: activo ? agendaColors.primaryDeep : agendaColors.muted }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconoBorrarFecha() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" {...trazo} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function IconoServicio() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...trazo} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconoDerecha() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...trazo} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function Contenido({ onCerrar, fecha, servicioId, onBorrarFecha, onAbrirCalendario, onAbrirServicios }: Omit<Props, 'abierto'>) {
  const t = useTranslations('profesionales.Filtros');
  const locale = useLocale();
  const guardados = useProAgendaStore((s) => s.filtros);
  const servicios = useProServicios();
  const titulo = useRef<HTMLHeadingElement>(null);
  const [buscar, setBuscar] = useState(guardados.buscar);
  const [errorBuscar, setErrorBuscar] = useState<'demasiadasPalabras' | 'larga' | null>(null);

  // El foco entra al diálogo apenas se monta; quien lo abrió lo recupera al cerrar.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape') onCerrar();
  }

  function aplicar() {
    const resultadoBuscar = validarBuscar(buscar);
    setErrorBuscar(resultadoBuscar === 'ok' ? null : resultadoBuscar);
    if (resultadoBuscar !== 'ok') return;
    // La fecha es una sola: el pedido es un rango de ese día (desde = hasta).
    useProAgendaStore.getState().setFiltros({ buscar: normalizarBuscar(buscar), servicioId, desde: fecha, hasta: fecha });
    onCerrar();
  }

  function limpiar() {
    useProAgendaStore.getState().limpiarFiltros();
    onCerrar();
  }

  // Con filtros ya guardados, aplicar un borrador vacío es la forma de quitarlos.
  const hayActivos = normalizarBuscar(buscar) !== '' || servicioId !== null || fecha !== null || hayFiltrosActivos(guardados);
  const servicio = servicios.data?.servicios.find((s) => s.id === servicioId)?.nombre;
  const ayudaBuscar = errorBuscar !== null ? 'filtros-buscar-error' : 'filtros-buscar-ayuda';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-filtros-titulo"
      onKeyDown={alTeclear}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 20px 24px', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
        <h2
          id="pro-filtros-titulo"
          ref={titulo}
          tabIndex={-1}
          style={{ margin: 0, fontSize: 16, fontWeight: 600, color: agendaColors.strong, outline: 'none' }}
        >
          {t('titulo')}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {hayActivos && (
            <button type="button" onClick={limpiar} style={accionTextoStyle}>
              {t('limpiarTodo')}
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            aria-label={t('cerrar')}
            style={{ ...accionTextoStyle, color: agendaColors.muted, display: 'flex', alignItems: 'center' }}
          >
            <IconoCerrar tam={18} />
          </button>
        </div>
      </div>

      <div>
        <p style={seccionStyle}>{t('seccionCliente')}</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderRadius: 12,
            backgroundColor: agendaColors.surfaceSubtle,
            border: `1px solid ${errorBuscar !== null ? agendaColors.danger : buscar !== '' ? agendaColors.primary : 'transparent'}`,
            color: agendaColors.muted,
          }}
        >
          <IconoBuscar />
          <input
            id="filtros-buscar"
            type="text"
            value={buscar}
            maxLength={120}
            autoComplete="off"
            placeholder={t('buscar')}
            aria-label={t('buscar')}
            aria-invalid={errorBuscar !== null}
            aria-describedby={ayudaBuscar}
            onChange={(e) => setBuscar(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              padding: 0,
              color: agendaColors.text,
            }}
          />
          {buscar !== '' && (
            <button
              type="button"
              onClick={() => setBuscar('')}
              aria-label={t('borrarBusqueda')}
              style={{ display: 'flex', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: agendaColors.muted }}
            >
              <IconoCerrar tam={16} />
            </button>
          )}
        </div>
        {errorBuscar !== null ? (
          <p id="filtros-buscar-error" role="alert" style={{ margin: '6px 0 0', fontSize: 14, color: agendaColors.danger }}>
            {t(errorBuscar === 'larga' ? 'errorLarga' : 'errorPalabras')}
          </p>
        ) : (
          <p id="filtros-buscar-ayuda" style={{ margin: '6px 0 0', fontSize: 13, color: agendaColors.sub }}>
            {t('buscarAyuda')}
          </p>
        )}
      </div>

      <div>
        <p style={seccionStyle}>{t('seccionFecha')}</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 45,
            padding: '0 14px',
            borderRadius: 12,
            boxSizing: 'border-box',
            border: `1px solid ${fecha !== null ? fechaBordeActivo : 'transparent'}`,
            backgroundColor: fecha !== null ? fechaFondoActivo : agendaColors.surfaceSubtle,
          }}
        >
          <button
            type="button"
            onClick={onAbrirCalendario}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
              height: '100%',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <IconoCalendario activo={fecha !== null} />
            <span style={{ flex: 1, fontSize: 14, color: fecha !== null ? agendaColors.text : agendaColors.muted }}>
              {fecha !== null ? etiquetaCortaDeDia(fecha, locale) : t('fechaPlaceholder')}
            </span>
          </button>
          {fecha !== null && (
            <button
              type="button"
              onClick={onBorrarFecha}
              aria-label={t('borrarFecha')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 44,
                minHeight: 44,
                marginRight: -12,
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: agendaColors.primaryDeep,
              }}
            >
              <IconoBorrarFecha />
            </button>
          )}
        </div>
      </div>

      {servicios.data === null && servicios.error === null && <Spinner label={t('cargandoServicios')} />}
      {servicios.error !== null && servicios.data === null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <MensajeErrorPro error={servicios.error} id="filtros-servicios-error" />
          <button
            type="button"
            onClick={servicios.reintentar}
            aria-describedby="filtros-servicios-error"
            style={botonStyle(false)}
          >
            {t('reintentarServicios')}
          </button>
        </div>
      )}
      {servicios.data !== null && (
        // Tarjeta "Qué mostrar": ícono, etiqueta, valor y chevron. Toda la fila es un
        // botón que abre la hoja de selección de servicio.
        <div
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: agendaColors.surface,
            border: `1px solid ${agendaColors.divider}`,
          }}
        >
          <button
            type="button"
            onClick={onAbrirServicios}
            aria-label={`${t('servicio')}: ${servicio ?? t('todos')}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              minHeight: 56,
              padding: '0 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: agendaColors.primarySoft,
                color: agendaColors.primaryDeep,
              }}
            >
              <IconoServicio />
            </span>
            <span style={{ flexShrink: 0, fontSize: 15, color: agendaColors.textStrong }}>{t('servicio')}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: servicio === undefined ? agendaColors.muted : agendaColors.primary,
              }}
            >
              {servicio ?? t('todos')}
            </span>
            <span aria-hidden="true" style={{ display: 'flex', color: agendaColors.muted }}>
              <IconoDerecha />
            </span>
          </button>
        </div>
      )}

      <button type="button" onClick={aplicar} disabled={!hayActivos} style={botonStyle(true, !hayActivos)}>
        {t('verResultados')}
      </button>
    </div>
  );
}

// Filtros de la agenda del portal (AG-4): texto, fecha única y servicio, con el
// diseño de la hoja de filtros de la agenda de la titular (sin profesional).
// Valida antes de guardar: un valor inválido se informa en línea y no llega al
// store, así que no se pide nada. El estado se edita en borrador hasta "Ver
// resultados". La fecha y el servicio se eligen en hojas hermanas (el BottomSheet
// usa transform y atraparía un position: fixed), por eso entran por props.
export function FiltrosSheet({ abierto, ...contenido }: Props) {
  if (!abierto) return null;
  return (
    <>
      <div
        data-testid="fondo-filtros"
        aria-hidden="true"
        onClick={contenido.onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 59, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      />
      <BottomSheet
        snapPoints={SNAP_POINTS}
        initialIndex={0}
        enablePanDownToClose
        onChange={(indice) => {
          if (indice < 0) contenido.onCerrar();
        }}
        backgroundColor={agendaColors.bg}
        zIndex={60}
      >
        <Contenido {...contenido} />
      </BottomSheet>
    </>
  );
}
