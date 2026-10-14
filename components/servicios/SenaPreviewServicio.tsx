'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { parsearMonto } from '@/lib/parsearMonto';
import { formatMonto, formatMontoEntero } from '@/lib/money';
import { calcularSenaPreview, precioSugeridoSena, senaConfigurada } from '@/lib/senaPreview';
import { reservaOnlineActivaParaNegocio } from '@/lib/reservaOnline/activa';

interface Props {
  // Precio total tal como lo escribe el usuario (o el total de la promo).
  precio: string;
  // Aplica un precio (texto, para volcarlo directo al campo). Sin esto no se
  // ofrece la sugerencia de precio.
  onUsarPrecio?: (precio: string) => void;
  // Lleva a Perfil > Seña y pagos. Sin esto no se muestra el atajo.
  onConfigurar?: () => void;
  // Solo para tests: fuerza el criterio de "reserva online activa".
  activa?: boolean;
  // Precio con el que se abrió el formulario (servicio ya guardado). Mientras
  // el precio siga igual NO se ofrece cubrir la comisión: si no, cada vez que se
  // abre la edición volvería a sugerir un monto mayor. En su lugar se muestra una
  // pista de cómo hacer aparecer la sugerencia. Sin esto (servicio nuevo)
  // cualquier precio cargado cuenta como tocado.
  precioInicial?: string;
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

// Tarjeta "Seña de la reserva online" del formulario de servicio. En reposo dice
// dos cosas: cuánto deja el cliente de seña (y de dónde sale) y cuánto le llega a
// la profesional después de la comisión de Mercado Pago. La cuenta completa queda
// detrás de "Ver detalle". Si el precio no cubre la comisión, ofrece subirlo (o
// explica cómo hacer aparecer esa oferta). Solo existe si la reserva online está
// activa (la comisión de MP solo aplica al pago online). Sin seña configurada o
// sin precio no desaparece: explica qué falta y ofrece el atajo.
export default function SenaPreviewServicio({ precio, onUsarPrecio, onConfigurar, activa, precioInicial }: Props) {
  const t = useTranslations('configuracion.SenaPreviewServicio');
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  // Tras "Usar": precio previo y el aplicado. Mientras el campo siga valiendo
  // `nuevo` se muestra la confirmación; si la profesional lo edita, se vuelve a
  // sugerir.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);
  // La profesional pidió ver la sugerencia sin haber tocado el precio.
  const [verSugerencia, setVerSugerencia] = useState(false);

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
  const notaStyle = { margin: 0, fontSize: 13, lineHeight: 1.4, color: colors.subtext } as const;

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
  // La seña por porcentaje sube al múltiplo de 500: si no coincide con el % exacto, se aclara.
  const senaExacta = Math.round(valor * (user.sena_porcentaje ?? 0)) / 100;
  // Si llega al precio entero (precio chico o 100%), "el 30% de $30" sería falso.
  const origenPorcentaje = p.sena >= valor
    ? 'originFullPrice'
    : p.sena === senaExacta ? 'originPercent' : 'originPercentRounded';
  // Se ofrece cubrir la comisión solo si el precio se tocó en esta pantalla.
  const tocado = valor !== parsearMonto(precioInicial ?? '');
  const sugerido = onUsarPrecio && (tocado || verSugerencia) ? precioSugeridoSena(valor, user) : null;
  const sugerencia = sugerido !== null ? calcularSenaPreview(sugerido, user) : null;
  const confirmado = aplicado !== null && precio === aplicado.nuevo;
  const anterior = aplicado ? parsearMonto(aplicado.anterior) : null;
  // Pista: el precio no cubre la comisión y todavía no hay oferta. La oferta no se
  // empuja sola (la seña es un % del precio: cada ajuste volvería a ofrecer otro),
  // la profesional la pide con un botón.
  const mostrarPista = !!onUsarPrecio && porcentaje && !tocado && !verSugerencia && !confirmado && p.llega < p.sena;
  const cubre = p.llega >= p.sena;

  const usar = () => {
    if (sugerido === null || !onUsarPrecio) return;
    const nuevo = String(sugerido);
    setAplicado({ anterior: precio, nuevo });
    onUsarPrecio(nuevo);
  };
  const deshacer = () => {
    if (!aplicado || !onUsarPrecio) return;
    onUsarPrecio(aplicado.anterior);
    setAplicado(null);
  };

  const enNegrita = (chunks: ReactNode) => <b style={cifraStyle}>{chunks}</b>;
  const atenuado = (chunks: ReactNode) => <span style={{ color: colors.subtext }}>{chunks}</span>;

  const bannerStyle = {
    backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 12,
  } as const;
  // La oferta de cubrir la comisión es una opción, no una orden: tarjeta con
  // borde y botón de contorno (el relleno lo reservamos para "Deshacer").
  const ofertaStyle = {
    border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 12,
  } as const;
  const botonStyle = {
    width: '100%', minHeight: 44, border: 'none', borderRadius: 12,
    backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  } as const;
  const enlaceStyle = {
    alignSelf: 'flex-start', minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
    color: colors.primaryDeep, fontSize: 14, fontWeight: 600,
  } as const;

  return (
    <section style={sectionStyle}>
      {titulo}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={fraseStyle}>
          {t.rich('leaves', {
            sena: monto(p.sena),
            origen: porcentaje
              ? t(origenPorcentaje, { pct: user.sena_porcentaje ?? 0, precio: monto(valor) })
              : t('originFixed'),
            b: enNegrita,
            m: atenuado,
          })}
        </p>
        <p style={fraseStyle}>
          {t.rich('receives', {
            llega: monto(p.llega),
            b: chunks => (
              <b style={{ ...cifraStyle, color: cubre ? colors.primaryDeep : colors.amberFg }}>{chunks}</b>
            ),
          })}
        </p>
      </div>

      {confirmado && anterior !== null && (
        <div style={{ ...bannerStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, lineHeight: 1.35, color: colors.text, minWidth: 0 }}>
            {t('adjusted', { precio: monto(anterior) })}
          </span>
          <button type="button" onClick={deshacer} style={{ ...botonStyle, width: 'auto', flexShrink: 0, padding: '0 14px', minHeight: 40, fontSize: 13 }}>
            {t('undo')}
          </button>
        </div>
      )}
      {!confirmado && sugerido !== null && sugerido !== valor && sugerencia && (
        <div style={ofertaStyle}>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: colors.text }}>
            {t('coverQuestion', {
              sena: monto(p.sena), precio: monto(sugerido), actual: monto(valor),
              senaNueva: monto(sugerencia.sena),
            })}
          </span>
          <button type="button" onClick={usar} style={botonStyle}>{t('coverButton', { precio: monto(sugerido) })}</button>
        </div>
      )}
      {mostrarPista && (
        <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13.5, lineHeight: 1.45, color: colors.text }}>{t('hint')}</span>
          <button type="button" onClick={() => setVerSugerencia(true)} style={enlaceStyle}>{t('seeSuggestion')}</button>
        </div>
      )}

      <button type="button" aria-expanded={verDetalle} onClick={() => setVerDetalle(v => !v)} style={enlaceStyle}>
        {verDetalle ? t('hideDetail') : t('showDetail')}
      </button>
      {verDetalle && (
        <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...filaStyle, fontSize: 14, color: colors.text }}>
            <span style={etiquetaStyle}>{t('detailPays')}</span>
            <span style={montoStyle}>{monto(p.sena)}</span>
          </div>
          <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
            <span style={etiquetaStyle}>{t('mpFee', { rate: decimal(user.comision_mp_vigente ?? 0) })}</span>
            <span style={montoStyle}>{`− ${monto(p.cargo)}`}</span>
          </div>
          {hayRetencion && (
            <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
              <span style={etiquetaStyle}>{t('taxRetention')}</span>
              <span style={montoStyle}>{`− ${monto(p.retencion)}`}</span>
            </div>
          )}
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
