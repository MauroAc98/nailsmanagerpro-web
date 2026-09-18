'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { formatMontoCorto } from '@/lib/money';
import {
  usePrecioServiciosStore,
  resolverPreciosServicios,
} from '@/store/usePrecioServiciosStore';

const Z_INDEX = 100; // mismo nivel que ConfirmSheetHost/MotivoCancelacionSheetHost — nunca conviven

// Pide el precio final de cada servicio de un turno (al finalizarlo, o después
// desde "Precios por cargar"), prefilled con el precio de lista del catálogo
// (Servicio.precio) para minimizar tipeo — la profesional solo ajusta si el
// precio final cambió. También permite registrar el turno sin cobro (precio 0).
// Mismo patrón imperativo (promesa) que MotivoCancelacionSheetHost.
export function PrecioServiciosSheetHost() {
  const t = useTranslations('common.PrecioServiciosSheetHost');
  const locale = useLocale();
  const visible = usePrecioServiciosStore(state => state.visible);
  const servicios = usePrecioServiciosStore(state => state.servicios);
  const contexto = usePrecioServiciosStore(state => state.contexto);

  const [valores, setValores] = useState<Record<number, string>>({});
  const [sinCobro, setSinCobro] = useState(false);
  // Ventana de gracia tras abrirse: si el usuario tocó "Finalizar" y el tap
  // no registró (ver fix en agenda/page.tsx), es común que vuelva a tocar
  // casi en el mismo lugar. Como este sheet se renderiza pegado al fondo y
  // "Confirmar" queda ahí, ese segundo toque podía caer directo sobre
  // Confirmar y cerrar el turno con el precio de catálogo sin que la
  // profesional llegara a ver ni tocar el panel. Bloqueamos Confirmar los
  // primeros instantes para que un tap fantasma en tránsito no alcance.
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!visible) {
      setArmado(false);
      return;
    }
    const iniciales: Record<number, string> = {};
    for (const s of servicios) {
      iniciales[s.servicio_id] = s.precioReferencia != null ? String(s.precioReferencia) : '';
    }
    setValores(iniciales);
    setSinCobro(false);

    setArmado(false);
    const timer = setTimeout(() => setArmado(true), 350);
    return () => clearTimeout(timer);
  }, [visible, servicios]);

  const numero = (id: number): number | null => {
    const v = valores[id];
    return v !== undefined && v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) >= 0
      ? Number(v)
      : null;
  };

  const preciosFinales = servicios.map(s => ({
    servicio_id: s.servicio_id,
    precio: sinCobro ? 0 : numero(s.servicio_id),
  }));
  const total = preciosFinales.reduce((acc, p) => acc + (p.precio ?? 0), 0);
  const puedeConfirmar =
    armado && servicios.length > 0 && preciosFinales.every(p => p.precio !== null);

  const modo = contexto?.modo ?? 'finalizar';
  const confirmLabel = sinCobro
    ? t(modo === 'cargar' ? 'confirmCargarSinCobro' : 'confirmFinalizarSinCobro')
    : t(modo === 'cargar' ? 'confirmCargar' : 'confirmFinalizar', {
        total: `$${formatMontoCorto(total)}`,
      });

  const subtitulo = (() => {
    if (!contexto) return null;
    const partes: string[] = [];
    if (contexto.cliente) partes.push(contexto.cliente);
    if (contexto.fechaHora) {
      const d = new Date(contexto.fechaHora.replace(' ', 'T'));
      partes.push(
        d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }),
        d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    }
    return partes.join(' · ');
  })();

  const cerrar = (confirmar: boolean) => {
    if (!confirmar) {
      resolverPreciosServicios(null);
      return;
    }
    resolverPreciosServicios(
      preciosFinales.map(p => ({ servicio_id: p.servicio_id, precio: p.precio as number }))
    );
  };

  const diferenciaTexto = (diff: number) =>
    `${diff > 0 ? '+' : '−'}$${formatMontoCorto(Math.abs(diff))}`;

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
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: colors.surface,
          borderRadius: '20px 20px 0 0',
          boxShadow: shadows.sheet,
          padding: '28px 20px calc(20px + env(safe-area-inset-bottom))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontWeight: 400,
            fontSize: 24,
            color: colors.text,
            margin: 0,
          }}
        >
          {t(modo === 'cargar' ? 'titleCargar' : 'titleFinalizar')}
        </h2>
        {subtitulo && (
          <p style={{ fontSize: 13, color: colors.subtext, margin: '4px 0 0' }}>{subtitulo}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '20px 0' }}>
          {servicios.map(s => {
            const actual = numero(s.servicio_id);
            const diff =
              !sinCobro && actual !== null && s.precioReferencia != null
                ? actual - s.precioReferencia
                : 0;
            const ajustado = diff !== 0;
            return (
              <div
                key={s.servicio_id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.nombre}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
                    {s.precioReferencia != null
                      ? t('listPrice', { monto: `$${formatMontoCorto(s.precioReferencia)}` })
                      : t('noListPrice')}
                  </p>
                  {ajustado && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        backgroundColor: colors.successBg,
                        color: colors.success,
                      }}
                    >
                      {t('adjusted', { diferencia: diferenciaTexto(diff) })}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative', width: 132, flexShrink: 0 }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 17,
                      color: colors.subtext,
                      pointerEvents: 'none',
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    disabled={sinCobro}
                    aria-label={s.nombre}
                    value={sinCobro ? '0' : (valores[s.servicio_id] ?? '')}
                    onChange={e => setValores(prev => ({ ...prev, [s.servicio_id]: e.target.value }))}
                    placeholder={t('pricePlaceholder')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: colors.surface,
                      border: `1.5px solid ${ajustado ? colors.success : colors.border}`,
                      borderRadius: 12,
                      padding: '11px 12px 11px 28px',
                      fontSize: 17,
                      fontWeight: 600,
                      color: colors.text,
                      outline: 'none',
                      textAlign: 'right',
                      opacity: sinCobro ? 0.5 : 1,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSinCobro(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            color: colors.primarySolid,
            cursor: 'pointer',
          }}
        >
          {sinCobro ? t('charge') : t('noCharge')}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderTop: `1px solid ${colors.border}`,
            paddingTop: 14,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, color: colors.subtext }}>{t('total')}</span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 26,
              color: colors.text,
            }}
          >
            ${formatMontoCorto(total)}
          </span>
        </div>

        <button
          onClick={() => puedeConfirmar && cerrar(true)}
          disabled={!puedeConfirmar}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 14,
            border: 'none',
            backgroundColor: puedeConfirmar ? colors.primarySolid : colors.primaryDisabled,
            fontSize: 16,
            fontWeight: 600,
            color: '#FFF',
            cursor: puedeConfirmar ? 'pointer' : 'not-allowed',
          }}
        >
          {confirmLabel}
        </button>
        <button
          onClick={() => cerrar(false)}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '12px 0',
            border: 'none',
            background: 'none',
            fontSize: 15,
            fontWeight: 600,
            color: colors.subtext,
            cursor: 'pointer',
          }}
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
