'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import {
  usePrecioServiciosStore,
  resolverPreciosServicios,
} from '@/store/usePrecioServiciosStore';

const Z_INDEX = 100; // mismo nivel que ConfirmSheetHost/MotivoCancelacionSheetHost — nunca conviven

// Pide el precio final de cada servicio de un turno antes de finalizarlo,
// prefilled con el precio de referencia del catálogo (Servicio.precio) para
// minimizar tipeo — la profesional solo ajusta si el diseño elegido cambió
// el precio final. Mismo patrón imperativo (promesa) que MotivoCancelacionSheetHost.
export function PrecioServiciosSheetHost() {
  const t = useTranslations('common.PrecioServiciosSheetHost');
  const visible = usePrecioServiciosStore(state => state.visible);
  const servicios = usePrecioServiciosStore(state => state.servicios);

  const [valores, setValores] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!visible) return;
    const iniciales: Record<number, string> = {};
    for (const s of servicios) {
      iniciales[s.servicio_id] = s.precioReferencia != null ? String(s.precioReferencia) : '';
    }
    setValores(iniciales);
  }, [visible, servicios]);

  const puedeConfirmar =
    servicios.length > 0 &&
    servicios.every(s => {
      const v = valores[s.servicio_id];
      return v !== undefined && v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) >= 0;
    });

  const cerrar = (confirmar: boolean) => {
    if (!confirmar) {
      resolverPreciosServicios(null);
      return;
    }
    resolverPreciosServicios(
      servicios.map(s => ({ servicio_id: s.servicio_id, precio: Number(valores[s.servicio_id]) }))
    );
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
        onClick={() => cerrar(false)}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {servicios.map(s => (
            <div
              key={s.servicio_id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ fontSize: 14, color: colors.text, flex: 1 }}>{s.nombre}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={valores[s.servicio_id] ?? ''}
                onChange={e =>
                  setValores(prev => ({ ...prev, [s.servicio_id]: e.target.value }))
                }
                placeholder={t('pricePlaceholder')}
                style={{
                  width: 100,
                  boxSizing: 'border-box',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 14,
                  color: colors.text,
                  outline: 'none',
                  textAlign: 'right',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => cerrar(false)}
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
            onClick={() => puedeConfirmar && cerrar(true)}
            disabled={!puedeConfirmar}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              backgroundColor: puedeConfirmar ? colors.primary : colors.primaryDisabled,
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
