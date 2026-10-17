'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { Spinner } from '@/components/Spinner';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { FECHA_MINIMA } from '@/lib/pro/fechaHora';
import { hayFiltrosActivos, normalizarBuscar, validarBuscar, validarRango } from '@/lib/pro/filtros';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const SNAP_POINTS = [0.85];

const campoStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '0 14px',
  border: '1px solid transparent',
  borderRadius: 12,
  fontSize: 14,
  backgroundColor: agendaColors.surfaceSubtle,
  color: agendaColors.text,
};

// Título de sección en mayúsculas, igual que la hoja de filtros de la agenda.
const seccionStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 700,
  color: agendaColors.subtext,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const etiquetaStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: agendaColors.sub };

const botonStyle = (primario: boolean, deshabilitado = false): CSSProperties => ({
  minHeight: 44,
  padding: '14px',
  border: primario ? 'none' : `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.5 : 1,
  backgroundColor: primario ? agendaColors.primarySolid : agendaColors.surface,
  color: primario ? agendaColors.primaryFg : agendaColors.strong,
});

const accionTextoStyle = (deshabilitado: boolean): CSSProperties => ({
  minHeight: 44,
  padding: '0 8px',
  border: 'none',
  background: 'none',
  fontSize: 13,
  fontWeight: 600,
  color: agendaColors.primaryDeep,
  opacity: deshabilitado ? 0.5 : 1,
  cursor: deshabilitado ? 'default' : 'pointer',
});

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

function Contenido({ onCerrar }: { onCerrar: () => void }) {
  const t = useTranslations('profesionales.Filtros');
  const guardados = useProAgendaStore((s) => s.filtros);
  const servicios = useProServicios();
  const titulo = useRef<HTMLHeadingElement>(null);
  const [buscar, setBuscar] = useState(guardados.buscar);
  const [servicioId, setServicioId] = useState<number | null>(guardados.servicioId);
  const [desde, setDesde] = useState(guardados.desde ?? '');
  const [hasta, setHasta] = useState(guardados.hasta ?? '');
  const [errorBuscar, setErrorBuscar] = useState<'demasiadasPalabras' | 'larga' | null>(null);
  const [errorRango, setErrorRango] = useState(false);

  // El foco entra al diálogo apenas se monta; quien lo abrió lo recupera al cerrar.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape') onCerrar();
  }

  function aplicar() {
    const resultadoBuscar = validarBuscar(buscar);
    // Con un solo extremo, el otro toma la misma fecha (rango de un día).
    const d = desde || hasta;
    const h = hasta || desde;
    const rangoInvalido = d !== '' && validarRango(d, h) !== 'ok';
    setErrorBuscar(resultadoBuscar === 'ok' ? null : resultadoBuscar);
    setErrorRango(rangoInvalido);
    if (resultadoBuscar !== 'ok' || rangoInvalido) return;
    useProAgendaStore.getState().setFiltros({
      buscar: normalizarBuscar(buscar),
      servicioId,
      desde: d || null,
      hasta: h || null,
    });
    onCerrar();
  }

  function limpiar() {
    useProAgendaStore.getState().limpiarFiltros();
    onCerrar();
  }

  const hayActivos = hayFiltrosActivos(guardados);
  const opciones = servicios.data?.servicios ?? [];
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
          <button type="button" onClick={limpiar} disabled={!hayActivos} style={accionTextoStyle(!hayActivos)}>
            {t('limpiar')}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            aria-label={t('cerrar')}
            style={{ ...accionTextoStyle(false), color: agendaColors.muted, display: 'flex', alignItems: 'center' }}
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
        <div style={{ display: 'flex', gap: 10 }}>
          {(
            [
              ['filtros-desde', 'desde', desde, setDesde],
              ['filtros-hasta', 'hasta', hasta, setHasta],
            ] as const
          ).map(([id, clave, valor, set]) => (
            <div key={id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={id} style={etiquetaStyle}>
                {t(clave)}
              </label>
              <input
                id={id}
                type="date"
                min={FECHA_MINIMA}
                value={valor}
                aria-invalid={errorRango}
                aria-describedby={errorRango ? 'filtros-rango-error' : undefined}
                onChange={(e) => set(e.target.value)}
                style={{
                  ...campoStyle,
                  ...(errorRango
                    ? { borderColor: agendaColors.danger }
                    : valor !== ''
                      ? { borderColor: agendaColors.primary }
                      : null),
                }}
              />
            </div>
          ))}
        </div>
        {errorRango && (
          <p id="filtros-rango-error" role="alert" style={{ margin: '6px 0 0', fontSize: 14, color: agendaColors.danger }}>
            {t('errorRango')}
          </p>
        )}
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
        // Tarjeta "Qué mostrar": ícono, etiqueta, valor y chevron. El valor es un
        // <select> nativo que ocupa la fila: se conserva el teclado y el lector.
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 56,
            padding: '0 14px',
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: agendaColors.surface,
            border: `1px solid ${agendaColors.divider}`,
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
          <label htmlFor="filtros-servicio" style={{ flexShrink: 0, fontSize: 15, color: agendaColors.textStrong }}>
            {t('servicio')}
          </label>
          <select
            id="filtros-servicio"
            value={servicioId === null ? '' : String(servicioId)}
            onChange={(e) => setServicioId(e.target.value === '' ? null : Number(e.target.value))}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              appearance: 'none',
              textAlign: 'right',
              textAlignLast: 'right',
              fontSize: 14,
              fontWeight: 600,
              textOverflow: 'ellipsis',
              color: servicioId === null ? agendaColors.muted : agendaColors.primary,
            }}
          >
            <option value="">{t('todos')}</option>
            {opciones.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.nombre}
              </option>
            ))}
          </select>
          <span aria-hidden="true" style={{ display: 'flex', color: agendaColors.muted }}>
            <IconoDerecha />
          </span>
        </div>
      )}

      <button type="button" onClick={aplicar} style={botonStyle(true)}>
        {t('aplicar')}
      </button>
    </div>
  );
}

// Filtros de la agenda del portal (AG-4): texto, rango de fechas y servicio, con
// el diseño de la hoja de filtros de la agenda de la titular (sin profesional).
// Valida antes de guardar: un valor inválido se informa en línea y no llega al
// store, así que no se pide nada. El estado se edita en borrador hasta "Aplicar".
export function FiltrosSheet({ abierto, onCerrar }: Props) {
  if (!abierto) return null;
  return (
    <>
      <div
        data-testid="fondo-filtros"
        aria-hidden="true"
        onClick={onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 59, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      />
      <BottomSheet
        snapPoints={SNAP_POINTS}
        initialIndex={0}
        enablePanDownToClose
        onChange={(indice) => {
          if (indice < 0) onCerrar();
        }}
        backgroundColor={agendaColors.bg}
        zIndex={60}
      >
        <Contenido onCerrar={onCerrar} />
      </BottomSheet>
    </>
  );
}
