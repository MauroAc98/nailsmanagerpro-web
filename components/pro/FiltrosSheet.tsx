'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';
import { Spinner } from '@/components/Spinner';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { FECHA_MINIMA } from '@/lib/pro/fechaHora';
import { hayFiltrosActivos, normalizarBuscar, validarBuscar, validarRango } from '@/lib/pro/filtros';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
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
  padding: '0 12px',
  border: `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 16,
  backgroundColor: agendaColors.surface,
  color: agendaColors.strong,
};

const etiquetaStyle: CSSProperties = { fontSize: 14, fontWeight: 600, color: agendaColors.strong };

const botonStyle = (primario: boolean, deshabilitado = false): CSSProperties => ({
  minHeight: 44,
  padding: '0 16px',
  border: primario ? 'none' : `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 600,
  cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.5 : 1,
  backgroundColor: primario ? agendaColors.primarySolid : agendaColors.surface,
  color: primario ? agendaColors.primaryFg : agendaColors.strong,
});

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

  const opciones = servicios.data?.servicios ?? [];
  const ayudaBuscar = errorBuscar !== null ? 'filtros-buscar-error' : 'filtros-buscar-ayuda';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-filtros-titulo"
      onKeyDown={alTeclear}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 24px', minWidth: 0 }}
    >
      <h2
        id="pro-filtros-titulo"
        ref={titulo}
        tabIndex={-1}
        style={{ margin: 0, fontSize: 20, fontFamily: agendaFontSerif, color: agendaColors.strong, outline: 'none' }}
      >
        {t('titulo')}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="filtros-buscar" style={etiquetaStyle}>
          {t('buscar')}
        </label>
        <input
          id="filtros-buscar"
          type="text"
          value={buscar}
          maxLength={120}
          autoComplete="off"
          aria-invalid={errorBuscar !== null}
          aria-describedby={ayudaBuscar}
          onChange={(e) => setBuscar(e.target.value)}
          style={campoStyle}
        />
        {errorBuscar !== null ? (
          <p id="filtros-buscar-error" role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
            {t(errorBuscar === 'larga' ? 'errorLarga' : 'errorPalabras')}
          </p>
        ) : (
          <p id="filtros-buscar-ayuda" style={{ margin: 0, fontSize: 13, color: agendaColors.sub }}>
            {t('buscarAyuda')}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="filtros-servicio" style={etiquetaStyle}>
            {t('servicio')}
          </label>
          <select
            id="filtros-servicio"
            value={servicioId === null ? '' : String(servicioId)}
            onChange={(e) => setServicioId(e.target.value === '' ? null : Number(e.target.value))}
            style={campoStyle}
          >
            <option value="">{t('todos')}</option>
            {opciones.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

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
              style={campoStyle}
            />
          </div>
        ))}
      </div>
      {errorRango && (
        <p id="filtros-rango-error" role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
          {t('errorRango')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={aplicar} style={botonStyle(true)}>
          {t('aplicar')}
        </button>
        <button
          type="button"
          onClick={limpiar}
          disabled={!hayFiltrosActivos(guardados)}
          style={botonStyle(false, !hayFiltrosActivos(guardados))}
        >
          {t('limpiar')}
        </button>
        <button type="button" onClick={onCerrar} style={{ ...botonStyle(false), border: 'none', backgroundColor: 'transparent' }}>
          {t('cerrar')}
        </button>
      </div>
    </div>
  );
}

// Filtros de la agenda del portal (AG-4): texto, servicio y rango de fechas.
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
