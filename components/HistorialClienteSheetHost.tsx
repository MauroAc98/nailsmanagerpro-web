'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { useHistorialClienteStore, cerrarHistorial } from '@/store/useHistorialClienteStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import type { Profesional } from '@/services/profesionalService';
import { clienteService, Cliente } from '@/services/clienteService';
import type { Turno } from '@/services/turnoService';

type FiltroEstado = 'todos' | 'completado' | 'cancelado';

// Sheet global de "ver historial de turnos" de una cliente, disparado desde
// ClienteCard en la lista — mismo patrón que el filtro de agenda (BottomSheet
// con initialIndex=-1 + enablePanDownToClose, sincronizado con el store por
// onChange). Reemplaza al historial que antes vivía inline en la pantalla de
// editar cliente.

export function HistorialClienteSheetHost() {
  const t = useTranslations('common.HistorialClienteSheetHost');
  const tCommon = useTranslations('common');
  const clienteId = useHistorialClienteStore(state => state.clienteId);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');

  const { profesionales, fetchProfesionales } = useProfesionalStore();
  useEffect(() => {
    if (clienteId !== null && profesionales.length === 0) fetchProfesionales();
  }, [clienteId, profesionales.length, fetchProfesionales]);

  // Este host vive montado una sola vez en app/providers.tsx, por ENCIMA del
  // árbol de rutas — navegar a otra página (Link/router.push, sin pasar por
  // el pan-down-to-close ni el botón de cerrar) nunca desmonta este
  // componente, así que sin esto el sheet quedaba "colgado" flotando sobre
  // la página nueva indefinidamente (bug reportado 2026-08-17). Cerrar acá
  // en cuanto cambia la ruta es lo mismo que ya hace ProvidersInner con el
  // resto de la navegación basada en `pathname`.
  const pathname = usePathname();
  const pathnameAnterior = useRef(pathname);
  useEffect(() => {
    if (pathnameAnterior.current !== pathname) {
      pathnameAnterior.current = pathname;
      cerrarHistorial();
    }
  }, [pathname]);
  const profesionalesById = useMemo(
    () => new Map(profesionales.map(p => [p.id, p])),
    [profesionales]
  );

  useEffect(() => {
    if (clienteId === null) {
      sheetRef.current?.close();
      return;
    }
    let cancelado = false;
    setLoading(true);
    setCliente(null);
    setError(false);
    setFiltroEstado('todos');
    clienteService.getOne(clienteId)
      .then(c => { if (!cancelado) setCliente(c); })
      .catch(() => { if (!cancelado) setError(true); })
      .finally(() => { if (!cancelado) setLoading(false); });
    sheetRef.current?.snapToIndex(0);
    // Sin esto, abrir el historial de la cliente A y después el de B rápido
    // (antes de que resuelva el fetch de A) podía terminar mostrando los
    // datos de A en el sheet que dice ser de B.
    return () => { cancelado = true; };
  }, [clienteId]);

  const turnos = [...(cliente?.turnos ?? [])].sort(
    (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
  );
  const turnosFiltrados = filtroEstado === 'todos'
    ? turnos
    : turnos.filter(turno => turno.estado === filtroEstado);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={[0.7]}
      initialIndex={-1}
      enablePanDownToClose
      onChange={index => { if (index === -1) cerrarHistorial(); }}
    >
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.text, margin: '0 0 14px' }}>
          {cliente ? t('titleWithName', { nombre: cliente.nombre, apellido: cliente.apellido }) : t('title')}
        </p>

        {!loading && turnos.length > 0 && (
          <FiltroEstadoChips value={filtroEstado} onChange={setFiltroEstado} t={t} />
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>{tCommon('cargando')}</p>
        ) : error ? (
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{t('loadError')}</p>
        ) : turnos.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>{t('noTurnos')}</p>
        ) : turnosFiltrados.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>{t('noResultsForFilter')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turnosFiltrados.map(turno => (
              <TurnoHistorialCard
                key={turno.id}
                turno={turno}
                profesional={turno.profesional_id != null ? profesionalesById.get(turno.profesional_id) : undefined}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────
// FiltroEstadoChips — mismo estilo de pill que el selector de profesional
// de la agenda (borde/fondo del color activo cuando está seleccionado).
// ─────────────────────────────────────────────
type TFn = ReturnType<typeof useTranslations>;

function FiltroEstadoChips({ value, onChange, t }: { value: FiltroEstado; onChange: (v: FiltroEstado) => void; t: TFn }) {
  const filtroOpciones: { value: FiltroEstado; label: string }[] = [
    { value: 'todos', label: t('filterAll') },
    { value: 'completado', label: t('filterCompleted') },
    { value: 'cancelado', label: t('filterCancelled') },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {filtroOpciones.map(opcion => {
        const selected = value === opcion.value;
        return (
          <button
            key={opcion.value}
            onClick={() => onChange(opcion.value)}
            style={{
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
              border: `1px solid ${selected ? colors.primary : colors.divider}`,
              backgroundColor: selected ? colors.primary : colors.surface,
              color: selected ? '#FFF' : colors.text,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// TurnoHistorialCard — solo lectura, sin acciones de swipe/cancelar/completar
// (migrado desde clientes/[id]/page.tsx)
// ─────────────────────────────────────────────
function estadoLabels(t: TFn): Record<string, string> {
  return {
    confirmado: t('estadoConfirmado'),
    completado: t('estadoCompletado'),
    cancelado: t('estadoCancelado'),
  };
}

function estiloEstado(estado: string): { bg: string; border: string; text: string } {
  if (estado === 'completado') return { bg: colors.successBg, border: colors.successBorder, text: colors.success };
  if (estado === 'cancelado') return { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger };
  return { bg: colors.surfaceSubtle, border: colors.border, text: colors.text };
}

function formatFechaHora(fechaHora: string): string {
  const [fecha, hora] = fechaHora.split(/[T ]/);
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
}

function TurnoHistorialCard({ turno, profesional, t }: { turno: Turno; profesional?: Profesional; t: TFn }) {
  const estilo = estiloEstado(turno.estado);
  const labels = estadoLabels(t);

  return (
    <div
      style={{
        backgroundColor: colors.surface, borderRadius: 14,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>
          {formatFechaHora(turno.fecha_hora)}
        </p>
        <span
          style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            backgroundColor: estilo.bg, border: `1px solid ${estilo.border}`, color: estilo.text,
          }}
        >
          {labels[turno.estado] ?? turno.estado}
        </span>
      </div>

      {profesional && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, flexShrink: 0, backgroundColor: profesional.color || colors.primary }} />
          <p style={{ margin: 0, fontSize: 13, color: colors.subtext }}>{profesional.nombre}</p>
        </div>
      )}

      {turno.servicios.length > 0 && (
        <p style={{ margin: 0, fontSize: 13, color: colors.subtext }}>
          {turno.servicios.map(s => s.nombre).join(' + ')}
        </p>
      )}

      {turno.notas && (
        <p style={{ margin: 0, fontSize: 13, color: colors.subtext, fontStyle: 'italic' }}>{turno.notas}</p>
      )}

      {turno.estado === 'cancelado' && turno.motivo_cancelacion && (
        <p style={{ margin: 0, fontSize: 13, color: colors.danger }}>
          {t('motivo', { motivo: turno.motivo_cancelacion })}
          {turno.cancelado_en ? ` · ${formatFechaHora(turno.cancelado_en)}` : ''}
        </p>
      )}
    </div>
  );
}
