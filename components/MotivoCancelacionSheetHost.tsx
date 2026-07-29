'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import {
  useMotivoCancelacionStore,
  resolverMotivoCancelacion,
  MOTIVOS_CANCELACION,
} from '@/store/useMotivoCancelacionStore';

const Z_INDEX = 100; // mismo nivel que ConfirmSheetHost — nunca están abiertos a la vez

// Visualmente consistente con ConfirmSheetHost (mismo sheet, mismo backdrop),
// pero con una lista de motivos seleccionables en vez de solo texto, y un
// campo libre cuando se elige "Otro". El motivo es obligatorio: no hay forma
// de cancelar un turno sin dejarlo asentado para el historial.
export function MotivoCancelacionSheetHost() {
  const t = useTranslations('common.MotivoCancelacionSheetHost');
  const visible = useMotivoCancelacionStore(state => state.visible);
  // MOTIVOS_CANCELACION son los valores canónicos que viajan tal cual al
  // backend (motivo_cancelacion es texto libre, sin enum — ver
  // HistorialClienteSheetHost, que interpola el valor crudo guardado). Este
  // mapeo es solo para el label del botón; la selección/comparación/envío
  // siguen usando el valor canónico en español, nunca el traducido.
  const REASON_LABELS: Record<string, string> = {
    'Cliente canceló con aviso': t('reasonAvisoPrevio'),
    'Cliente no se presentó': t('reasonNoShow'),
    'Cliente pidió reprogramar': t('reasonReprogramar'),
    'Imprevisto de la profesional': t('reasonImprevisto'),
    Otro: t('reasonOtro'),
  };
  const [seleccion, setSeleccion] = useState<string>(MOTIVOS_CANCELACION[0]);
  const [otroTexto, setOtroTexto] = useState('');

  const esOtro = seleccion === 'Otro';
  const motivoFinal = esOtro ? otroTexto.trim() : seleccion;
  const puedeConfirmar = motivoFinal.length > 0;

  const cerrar = (motivo: string | null) => {
    resolverMotivoCancelacion(motivo);
    setSeleccion(MOTIVOS_CANCELACION[0]);
    setOtroTexto('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        onClick={() => cerrar(null)}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface,
          borderRadius: '20px 20px 0 0',
          boxShadow: shadows.sheet,
          padding: '28px 20px calc(20px + env(safe-area-inset-bottom))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: '0 0 16px' }}>
          {t('title')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: esOtro ? 12 : 20 }}>
          {MOTIVOS_CANCELACION.map(motivo => (
            <button
              key={motivo}
              onClick={() => setSeleccion(motivo)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${seleccion === motivo ? colors.primary : colors.border}`,
                backgroundColor: seleccion === motivo ? colors.surfaceSubtle : colors.surface,
                fontSize: 14,
                fontWeight: seleccion === motivo ? 600 : 400,
                color: colors.text,
                cursor: 'pointer',
              }}
            >
              {REASON_LABELS[motivo] ?? motivo}
            </button>
          ))}
        </div>

        {esOtro && (
          <textarea
            autoFocus
            placeholder={t('otherPlaceholder')}
            value={otroTexto}
            onChange={e => setOtroTexto(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 70,
              resize: 'vertical',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 14,
              color: colors.text,
              outline: 'none',
              marginBottom: 20,
              fontFamily: 'inherit',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => cerrar(null)}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              fontSize: 15,
              fontWeight: 600,
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            {t('back')}
          </button>
          <button
            onClick={() => puedeConfirmar && cerrar(motivoFinal)}
            disabled={!puedeConfirmar}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              backgroundColor: puedeConfirmar ? colors.danger : colors.primaryDisabled,
              fontSize: 15,
              fontWeight: 600,
              color: '#FFF',
              cursor: puedeConfirmar ? 'pointer' : 'not-allowed',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
