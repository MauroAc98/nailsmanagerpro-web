'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { parsearMonto } from '@/lib/parsearMonto';
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
  // abre la edición volvería a sugerir un monto mayor. Sin esto (servicio nuevo)
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

// Tarjeta "Seña de la reserva online" del formulario de servicio: explica cuánto
// paga el cliente, cuánto cobra Mercado Pago y cuánto le llega a la profesional,
// y sugiere un precio que cubre la comisión. Solo existe si la reserva online
// está activa (la comisión de MP solo aplica al pago online). Sin seña
// configurada o sin precio no desaparece: explica qué falta y ofrece el atajo.
export default function SenaPreviewServicio({ precio, onUsarPrecio, onConfigurar, activa, precioInicial }: Props) {
  const t = useTranslations('configuracion.SenaPreviewServicio');
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  // Tras "Usar": precio previo y el aplicado. Mientras el campo siga valiendo
  // `nuevo` se muestra la confirmación; si la profesional lo edita, se vuelve a
  // sugerir.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);

  if (!(activa ?? reservaOnlineActivaParaNegocio(user)) || !user) return null;

  const numero = locale === 'es' ? 'es-AR' : locale;
  const monto = (n: number) => `$${new Intl.NumberFormat(numero, { maximumFractionDigits: 2 }).format(n)}`;
  const decimal = (n: number) =>
    new Intl.NumberFormat(numero, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

  // Qué seña se está usando para el cálculo, a la vista junto al atajo.
  const resumenSena = !senaConfigurada(user)
    ? null
    : user.sena_tipo === 'porcentaje'
      ? t('configuredPercent', { pct: user.sena_porcentaje ?? 0 })
      : t('configuredFixed', { monto: monto(Number(user.sena_monto ?? 0)) });

  const atajo = onConfigurar && (
    <>
      <div style={{ height: 1, backgroundColor: colors.hairline }} />
      <button
        type="button"
        onClick={onConfigurar}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: colors.text,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          {resumenSena && (
            <span style={{ display: 'block', fontSize: 13, color: colors.subtext }}>{resumenSena}</span>
          )}
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{t('configure')}</span>
        </span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
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

  const comision = typeof user.comision_mp_vigente === 'number' ? decimal(user.comision_mp_vigente) : null;
  const nota = comision !== null && <p style={notaStyle}>{t('commissionNote', { rate: comision })}</p>;

  const valor = parsearMonto(precio);
  const p = valor !== null ? calcularSenaPreview(valor, user) : null;
  if (valor === null || !p) {
    return (
      <section style={sectionStyle}>
        {titulo}
        {nota}
        <p style={notaStyle}>{t('enterPrice')}</p>
        {atajo}
      </section>
    );
  }

  const hayRetencion = p.retencion > 0;
  // Se ofrece cubrir la comisión solo si el precio se tocó en esta pantalla.
  const tocado = valor !== parsearMonto(precioInicial ?? '');
  const sugerido = onUsarPrecio && tocado ? precioSugeridoSena(valor, user) : null;
  const sugerencia = sugerido !== null ? calcularSenaPreview(sugerido, user) : null;
  const confirmado = aplicado !== null && precio === aplicado.nuevo;
  const anterior = aplicado ? parsearMonto(aplicado.anterior) : null;

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

  const bannerStyle = {
    backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 12,
  } as const;
  // La oferta de cubrir la comisión es una opción, no una orden: tarjeta con
  // borde y botón de contorno (el relleno lo reservamos para "Deshacer").
  const ofertaStyle = {
    border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12,
    display: 'flex', flexDirection: 'column', gap: 10,
  } as const;
  const botonSecundarioStyle = {
    alignSelf: 'flex-start', minHeight: 44, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
    backgroundColor: 'transparent', border: `1.5px solid ${colors.primarySolid}`, color: colors.primaryDeep,
    fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  } as const;
  const botonStyle = {
    width: '100%', minHeight: 44, border: 'none', borderRadius: 12,
    backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  } as const;

  return (
    <section style={sectionStyle}>
      {titulo}
      {nota}

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
      {!confirmado && sugerido !== null && sugerencia && (
        <div style={ofertaStyle}>
          <span style={{ fontSize: 13.5, lineHeight: 1.4, color: colors.text }}>
            {t('coverQuestion', { sena: monto(p.sena), precio: monto(sugerido), senaNueva: monto(sugerencia.sena), llega: monto(sugerencia.llega) })}
          </span>
          <button type="button" onClick={usar} style={botonSecundarioStyle}>{t('coverButton', { precio: monto(sugerido) })}</button>
        </div>
      )}

      <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...filaStyle, fontSize: 14, fontWeight: 700, color: colors.text }}>
          <span style={etiquetaStyle}>{t('clientPays')}</span>
          <span style={montoStyle}>{monto(p.sena)}</span>
        </div>
        <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
          <span style={etiquetaStyle}>{t('mpFee', { rate: decimal(user.comision_mp_vigente) })}</span>
          <span style={montoStyle}>{monto(p.cargo)}</span>
        </div>
        {hayRetencion && (
          <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
            <span style={etiquetaStyle}>{t('taxRetention')}</span>
            <span style={montoStyle}>{monto(p.retencion)}</span>
          </div>
        )}
        <div style={{ height: 1, backgroundColor: colors.border }} />
        <div style={{ ...filaStyle, fontSize: 15, fontWeight: 700, color: colors.text }}>
          <span style={etiquetaStyle}>{t('netReceived')}</span>
          <span style={{ ...montoStyle, fontSize: 17 }}>{monto(p.llega)}</span>
        </div>
        <span style={{ fontSize: 12.5, color: colors.subtext, lineHeight: 1.4 }}>
          {t('costNote', { cost: decimal(p.costoPct) })}
        </span>
      </div>

      {atajo}
    </section>
  );
}
