'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { parsearMonto } from '@/lib/parsearMonto';
import { formatMonto, formatMontoEntero } from '@/lib/money';
import {
  calcularSenaPreview, pasoSenaPorcentaje, senaConfigurada, senaMinimaQueCubre, senaPorcentajeExacta,
} from '@/lib/senaPreview';
import { reservaOnlineActivaParaNegocio } from '@/lib/reservaOnline/activa';

interface Props {
  // Precio total tal como lo escribe el usuario (o el total de la promo).
  precio: string;
  // Lleva a Perfil > Seña y pagos. Sin esto no se muestra el atajo.
  onConfigurar?: () => void;
  // Solo para tests: fuerza el criterio de "reserva online activa".
  activa?: boolean;
}

const sectionStyle = {
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14,
  boxShadow: shadows.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
} as const;
const filaStyle = { display: 'flex', justifyContent: 'space-between', gap: 12 } as const;
// El monto nunca se corta con "…": no se achica ni baja de renglón, y es la
// etiqueta (minWidth 0) la que cede el lugar.
const montoStyle = { whiteSpace: 'nowrap', flexShrink: 0 } as const;
const etiquetaStyle = { minWidth: 0 } as const;
const fraseStyle = { margin: 0, fontSize: 15, lineHeight: 1.5, color: colors.text } as const;
const cifraStyle = { fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' } as const;
const notaStyle = { margin: 0, fontSize: 13, lineHeight: 1.4, color: colors.subtext } as const;
const enlaceStyle = {
  alignSelf: 'flex-start', minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
  color: colors.primaryDeep, fontSize: 14, fontWeight: 600,
} as const;

// Tarjeta "Seña de la reserva online" del formulario de servicio. En reposo dice dos cosas:
// cuánto deja el cliente de seña y cuánto se queda Mercado Pago (y cuánto le llega a la
// profesional). Con seña por porcentaje, la seña ya incluye el costo de Mercado Pago, así que no hay
// nada que ajustar en el precio. La cuenta completa queda detrás de "Ver detalle". Solo existe si la
// reserva online está activa (la comisión de MP solo aplica al pago online). Sin seña configurada o
// sin precio no desaparece: explica qué falta y ofrece el atajo.
export default function SenaPreviewServicio({ precio, onConfigurar, activa }: Props) {
  const t = useTranslations('configuracion.SenaPreviewServicio');
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  const [verDetalle, setVerDetalle] = useState(false);

  if (!(activa ?? reservaOnlineActivaParaNegocio(user)) || !user) return null;

  const numero = locale === 'es' ? 'es-AR' : locale;
  // Sin centavos cuando el monto es redondo: "$24.000", no "$24.000,00".
  const monto = (n: number) => `$${Number.isInteger(n) ? formatMontoEntero(n) : formatMonto(n)}`;
  const decimal = (n: number) =>
    new Intl.NumberFormat(numero, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

  const porcentaje = user.sena_tipo === 'porcentaje';
  // Qué seña se está usando para el cálculo, a la vista junto al atajo.
  const resumenSena = !senaConfigurada(user)
    ? null
    : porcentaje
      ? t('configuredPercent', { pct: user.sena_porcentaje ?? 0 })
      : t('configuredFixed', { monto: monto(Number(user.sena_monto ?? 0)) });

  const chevron = (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
  // Sin seña configurada: el atajo es la salida. Con seña configurada: una línea
  // chica con lo configurado y "Cambiar".
  const atajo = onConfigurar && (
    <>
      <div style={{ height: 1, backgroundColor: colors.hairline }} />
      {resumenSena ? (
        <div style={{ ...filaStyle, alignItems: 'center', fontSize: 13, color: colors.subtext }}>
          <span style={etiquetaStyle}>{resumenSena}</span>
          <button
            type="button"
            onClick={onConfigurar}
            style={{
              minHeight: 44, padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer',
              color: colors.primaryDeep, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {t('change')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConfigurar}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: 0,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: colors.text,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{t('configure')}</span>
          {chevron}
        </button>
      )}
    </>
  );
  const titulo = (
    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{t('sectionTitle')}</h2>
  );

  // Sin seña configurada: no hay nada que calcular, pero el atajo sí.
  if (!senaConfigurada(user)) {
    return (
      <section style={sectionStyle}>
        {titulo}
        <p style={notaStyle}>{t('notConfigured')}</p>
        {atajo}
      </section>
    );
  }

  const valor = parsearMonto(precio);
  const p = valor !== null ? calcularSenaPreview(valor, user) : null;
  if (valor === null || !p) {
    return (
      <section style={sectionStyle}>
        {titulo}
        <p style={notaStyle}>{t('enterPrice')}</p>
        {atajo}
      </section>
    );
  }

  const hayRetencion = p.retencion > 0;
  const costos = p.cargo + p.retencion;
  // Pasos de la seña por porcentaje: el % exacto, lo que se suma para cubrir el costo y el
  // redondeo. Si la seña llega al precio entero (precio chico o 100%) no hay pasos que mostrar.
  const pasos = porcentaje && p.sena < valor
    ? (() => {
        const exacta = senaPorcentajeExacta(valor, user.sena_porcentaje ?? 0);
        const minimo = senaMinimaQueCubre(exacta, user);
        return { exacta, cubrir: minimo - exacta, redondeo: p.sena - minimo, paso: pasoSenaPorcentaje(minimo) };
      })()
    : null;

  const enNegrita = (chunks: ReactNode) => <b style={cifraStyle}>{chunks}</b>;
  const filaDetalle = (etiqueta: string, valorFila: string, opciones: { fuerte?: boolean; tenue?: boolean } = {}) => (
    <div
      style={{
        ...filaStyle, fontSize: 14, color: opciones.tenue ? colors.subtext : colors.text,
        fontWeight: opciones.fuerte ? 700 : 400,
      }}
    >
      <span style={etiquetaStyle}>{etiqueta}</span>
      <span style={montoStyle}>{valorFila}</span>
    </div>
  );

  return (
    <section style={sectionStyle}>
      {titulo}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Vista normal: solo cifras firmes. No se muestra "lo que llega del servicio": el precio
            del catálogo es un "desde" y el final depende del diseño. */}
        <p style={fraseStyle}>{t.rich('leaves', { sena: monto(p.sena), b: enNegrita })}</p>
        <p style={fraseStyle}>
          {t.rich(hayRetencion ? 'keepsWithRetention' : 'keeps', {
            costos: monto(costos), llega: monto(p.llega), b: enNegrita,
          })}
        </p>
        {pasos && (
          <p style={notaStyle}>
            {/* Si el redondeo deja de más, se dice: si no, "te llega el 30 %" y la cifra de arriba no cierran. */}
            {p.llega > pasos.exacta
              ? t('coveredNoteExtra', {
                  pct: user.sena_porcentaje ?? 0, exacta: monto(pasos.exacta), extra: monto(p.llega - pasos.exacta),
                })
              : t('coveredNote', { pct: user.sena_porcentaje ?? 0, exacta: monto(pasos.exacta) })}
          </p>
        )}
      </div>

      <button type="button" aria-expanded={verDetalle} onClick={() => setVerDetalle(v => !v)} style={enlaceStyle}>
        {verDetalle ? t('hideDetail') : t('showDetail')}
      </button>
      {verDetalle && (
        <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {porcentaje && filaDetalle(t('detailPrice'), monto(valor))}
          {pasos && filaDetalle(t('detailPercent', { pct: user.sena_porcentaje ?? 0 }), monto(pasos.exacta))}
          {pasos && pasos.cubrir > 0 && filaDetalle(t('detailCover'), `+ ${monto(pasos.cubrir)}`, { tenue: true })}
          {pasos && pasos.redondeo > 0 &&
            filaDetalle(t('detailRounding', { paso: monto(pasos.paso) }), `+ ${monto(pasos.redondeo)}`, { tenue: true })}
          {filaDetalle(t('detailPays'), monto(p.sena), { fuerte: porcentaje })}
          {filaDetalle(t('mpFee', { rate: decimal(user.comision_mp_vigente ?? 0) }), `− ${monto(p.cargo)}`, { tenue: true })}
          {hayRetencion && filaDetalle(t('taxRetention'), `− ${monto(p.retencion)}`, { tenue: true })}
          <div style={{ height: 1, backgroundColor: colors.border }} />
          <div style={{ ...filaStyle, fontSize: 15, fontWeight: 700, color: colors.text }}>
            <span style={etiquetaStyle}>{t('netReceived')}</span>
            <span style={{ ...montoStyle, fontSize: 17 }}>{monto(p.llega)}</span>
          </div>
        </div>
      )}

      {atajo}
    </section>
  );
}
