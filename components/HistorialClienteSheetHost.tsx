'use client';

import { useEffect, useRef, useState } from 'react';
import { colors, shadows } from '@/theme/colors';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { useHistorialClienteStore, cerrarHistorial } from '@/store/useHistorialClienteStore';
import { clienteService, Cliente } from '@/services/clienteService';
import type { Turno } from '@/services/turnoService';

// Sheet global de "ver historial de turnos" de una clienta, disparado desde
// ClienteCard en la lista — mismo patrón que el filtro de agenda (BottomSheet
// con initialIndex=-1 + enablePanDownToClose, sincronizado con el store por
// onChange). Reemplaza al historial que antes vivía inline en la pantalla de
// editar cliente.

export function HistorialClienteSheetHost() {
  const clienteId = useHistorialClienteStore(state => state.clienteId);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clienteId === null) {
      sheetRef.current?.close();
      return;
    }
    setLoading(true);
    setCliente(null);
    clienteService.getOne(clienteId)
      .then(setCliente)
      .finally(() => setLoading(false));
    sheetRef.current?.snapToIndex(0);
  }, [clienteId]);

  const turnos = [...(cliente?.turnos ?? [])].sort(
    (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
  );

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
          Historial{cliente ? ` — ${cliente.nombre} ${cliente.apellido}` : ''}
        </p>

        {loading ? (
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Cargando...</p>
        ) : turnos.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Esta clienta todavía no tiene turnos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turnos.map(turno => <TurnoHistorialCard key={turno.id} turno={turno} />)}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────
// TurnoHistorialCard — solo lectura, sin acciones de swipe/cancelar/completar
// (migrado desde clientes/[id]/page.tsx)
// ─────────────────────────────────────────────
const ESTADO_LABELS: Record<string, string> = {
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

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

function TurnoHistorialCard({ turno }: { turno: Turno }) {
  const estilo = estiloEstado(turno.estado);

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
          {ESTADO_LABELS[turno.estado] ?? turno.estado}
        </span>
      </div>

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
          Motivo: {turno.motivo_cancelacion}
          {turno.cancelado_en ? ` · ${formatFechaHora(turno.cancelado_en)}` : ''}
        </p>
      )}
    </div>
  );
}
