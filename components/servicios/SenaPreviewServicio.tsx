'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useAuthStore } from '@/store/useAuthStore';
import { parsearMonto } from '@/lib/parsearMonto';
import { calcularSenaPreview, precioSugeridoSena } from '@/lib/senaPreview';

interface Props {
  // Precio total tal como lo escribe el usuario (o el total de la promo).
  precio: string;
  // Aplica un precio (texto, para volcarlo directo al campo). Sin esto no se
  // ofrece la sugerencia de precio.
  onUsarPrecio?: (precio: string) => void;
}

const cardStyle = {
  backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 16,
  padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
} as const;
const filaStyle = { display: 'flex', justifyContent: 'space-between', gap: 12 } as const;
// El monto nunca se corta con "…": no se achica ni baja de renglón, y es la
// etiqueta (minWidth 0) la que cede el lugar.
const montoStyle = { whiteSpace: 'nowrap', flexShrink: 0 } as const;
const etiquetaStyle = { minWidth: 0 } as const;

// Vista previa de la seña bajo el campo de precio de un servicio. No renderiza
// nada si el salón no tiene una seña válida configurada o el precio no es un
// monto válido.
export default function SenaPreviewServicio({ precio, onUsarPrecio }: Props) {
  const t = useTranslations('configuracion.SenaPreviewServicio');
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  // Tras "Usar": precio previo y el aplicado. Mientras el campo siga valiendo
  // `nuevo` se muestra la confirmación; si la profesional lo edita, se vuelve a
  // sugerir.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);

  const numero = locale === 'es' ? 'es-AR' : locale;
  const monto = (n: number) => `$${new Intl.NumberFormat(numero, { maximumFractionDigits: 2 }).format(n)}`;
  const decimal = (n: number) =>
    new Intl.NumberFormat(numero, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

  const valor = parsearMonto(precio);
  if (!user || valor === null) return null;
  const p = calcularSenaPreview(valor, user);
  if (!p) return null;

  const hayRetencion = p.retencion > 0;
  const sugerido = onUsarPrecio ? precioSugeridoSena(valor, user) : null;
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

  const botonStyle = {
    flexShrink: 0, minHeight: 40, border: 'none', borderRadius: 12, padding: '0 14px',
    backgroundColor: colors.primarySolid, color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  } as const;
  const bannerStyle = {
    backgroundColor: colors.primarySoft, borderRadius: 14, padding: '12px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  } as const;

  return (
    <>
      {confirmado && anterior !== null && (
        <div style={bannerStyle}>
          <span style={{ fontSize: 13, lineHeight: 1.35, color: colors.text, minWidth: 0 }}>
            {t('adjusted', { precio: monto(anterior) })}
          </span>
          <button type="button" onClick={deshacer} style={botonStyle}>{t('undo')}</button>
        </div>
      )}
      {!confirmado && sugerido !== null && sugerencia && (
        <div style={bannerStyle}>
          <span style={{ fontSize: 13, lineHeight: 1.35, color: colors.text, minWidth: 0 }}>
            {t('suggestion', { precio: monto(sugerido), sena: monto(sugerencia.sena), llega: monto(sugerencia.llega) })}
          </span>
          <button type="button" onClick={usar} style={botonStyle}>{t('useSuggestion', { precio: monto(sugerido) })}</button>
        </div>
      )}

      <div style={cardStyle}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.subtext }}>
          {t('clientTitle')}
        </span>
        <div style={{ ...filaStyle, fontSize: 15, fontWeight: 700, color: colors.text }}>
          <span style={etiquetaStyle}>{t('deposit')}</span>
          <span style={{ ...montoStyle, fontSize: 17 }}>{monto(p.sena)}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.primaryDeep }}>
          {t('receiveTitle')}
        </span>
        <div style={{ ...filaStyle, fontSize: 14, color: colors.text }}>
          <span style={etiquetaStyle}>{t('clientPays')}</span>
          <span style={montoStyle}>{monto(p.sena)}</span>
        </div>
        <div style={{ ...filaStyle, fontSize: 14, color: colors.text }}>
          <span style={etiquetaStyle}>{t('mpFee', { rate: decimal(user.comision_mp_vigente) })}</span>
          <span style={montoStyle}>{monto(p.cargo)}</span>
        </div>
        {hayRetencion && (
          <div style={{ ...filaStyle, fontSize: 14, color: colors.text }}>
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
    </>
  );
}
