'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { SegmentedControl } from '@/components/SegmentedControl';
import PillToggle from '@/components/PillToggle';
import { parsearMonto } from '@/lib/parsearMonto';
import { formatMonto, formatMontoEntero } from '@/lib/money';
import { calcularSena, desgloseSena, senaFijaSugerida } from '@/lib/senaPreview';
import { SheetInput } from './SheetInput';
import type { SenaCampo, SenaModo } from '@/lib/senaConfig';

const PORCENTAJES_PREDEFINIDOS = [20, 30, 50, 100];
// Precio de ejemplo de la calculadora en modo porcentaje.
const PRECIO_EJEMPLO = 10000;

interface Props {
  senaTipo: SenaModo;
  setSenaTipo: (v: SenaModo) => void;
  // Porcentaje elegido, como texto (el chip tocado o el valor guardado).
  senaPorcentaje: string;
  setSenaPorcentaje: (v: string) => void;
  // Porcentaje guardado en el negocio: si no es uno de los chips, se agrega un
  // chip extra con ese valor para no perderlo de vista.
  porcentajeGuardado: number | null;
  senaMonto: string;
  setSenaMonto: (v: string) => void;
  // Error de formato local (perfil/page.tsx), no del guard de negocio: ese
  // llega en erroresServidor.
  error: string | null;
  errorPorcentaje: string | null;
  // 422 del backend por campo (p. ej. el guard de Mercado Pago que rechaza
  // vaciar el monto mientras haya una cuenta conectada).
  erroresServidor?: Partial<Record<SenaCampo, string>>;
  // Retención de impuestos: apagada guarda 0, prendida guarda el porcentaje cargado.
  retiene: boolean;
  setRetiene: (v: boolean) => void;
  retencion: string;
  setRetencion: (v: string) => void;
  errorRetencion: string | null;
  // Comisión de MP con IVA (user.comision_mp_vigente); null = no se muestra. Solo se
  // muestra con la reserva online activa (ver reservaOnlineActiva).
  comisionVigente: number | null;
  // El cálculo y la sugerencia de cubrir la comisión solo tienen sentido con la
  // reserva online activa (es donde se cobra la seña por Mercado Pago).
  reservaOnlineActiva: boolean;
  // Si viene, el enlace "Mensajes automáticos" abre esa hoja; si no, es texto.
  onIrAMensajes?: () => void;
  onGuardar: () => void;
  guardando: boolean;
  onClose: () => void;
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15 9.5c0-1.5-1.5-2.5-3-2.5s-3 1-3 2.5 1.5 2 3 2.5 3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5" />
    </svg>
  );
}

const avisoStyle = { fontSize: 12.5, color: colors.subtext, lineHeight: 1.4 } as const;
const errorStyle = { fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16, lineHeight: 1.4 } as const;

const filaStyle = { display: 'flex', justifyContent: 'space-between', gap: 12 } as const;
// El monto nunca se corta: no se achica ni baja de renglón; la etiqueta cede.
const montoStyle = { whiteSpace: 'nowrap', flexShrink: 0 } as const;
const enlaceStyle = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap',
  fontSize: 13, fontWeight: 600, color: colors.primaryDeep,
} as const;
const calculadoraStyle = {
  backgroundColor: colors.surfaceSubtle, borderRadius: 16, padding: 16, marginBottom: 16,
  display: 'flex', flexDirection: 'column', gap: 10,
} as const;
const montoGrandeStyle = {
  ...montoStyle, fontFamily: agendaFontSerif, fontSize: 30, fontWeight: 600, color: colors.text,
  fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
} as const;
const llegaStyle = { ...montoStyle, fontSize: 20, fontWeight: 700, color: colors.success, fontVariantNumeric: 'tabular-nums' } as const;
const pildoraStyle = {
  width: '100%', minHeight: 44, borderRadius: 22, cursor: 'pointer', padding: '8px 16px',
  backgroundColor: 'transparent', border: `1px solid ${colors.primarySolid}`, color: colors.primaryDeep,
  fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 12,
} as const;
const filaDivisoriaStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '12px 0', borderTop: `1px solid ${colors.hairline}`, borderBottom: `1px solid ${colors.hairline}`,
} as const;

function formatearTasa(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function SheetSenaYPagos({
  senaTipo, setSenaTipo, senaPorcentaje, setSenaPorcentaje, porcentajeGuardado,
  senaMonto, setSenaMonto, error, errorPorcentaje, erroresServidor,
  retiene, setRetiene, retencion, setRetencion, errorRetencion, comisionVigente,
  reservaOnlineActiva, onIrAMensajes, onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetSenaYPagos');
  // Tras aplicar la sugerencia: monto previo y el aplicado, para poder deshacer.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const errorMonto = error ?? erroresServidor?.sena_monto;
  const errorPorcentajeMostrado = errorPorcentaje ?? erroresServidor?.sena_porcentaje;
  const errorRetencionMostrado = errorRetencion ?? erroresServidor?.retencion_iibb_porcentaje;
  // Vista de Mercado Pago dentro de la misma hoja. Si ya hay un error de
  // retención al abrir, arranca ahí para que se vea; si aparece después
  // (validación al guardar), también se muestra bajo la fila de la vista principal.
  const [vistaMp, setVistaMp] = useState(Boolean(errorRetencionMostrado));
  const [verDonde, setVerDonde] = useState(false);
  const chips = porcentajeGuardado != null && !PORCENTAJES_PREDEFINIDOS.includes(porcentajeGuardado)
    ? [...PORCENTAJES_PREDEFINIDOS, porcentajeGuardado]
    : PORCENTAJES_PREDEFINIDOS;
  const porcentajeElegido = Number(senaPorcentaje.replace(',', '.'));

  // Cálculo de la seña: lo que paga el cliente, lo que cobra MP y lo que llega,
  // más una seña sugerida que cubre el costo (redondeada hacia arriba a múltiplos de 500 o 1000).
  const dinero = (n: number) => `$${formatMonto(n)}`;
  const montoFijo = senaTipo === 'fijo' ? parsearMonto(senaMonto) : null;
  const retencionPct = retiene ? (parsearMonto(retencion) ?? 0) : 0;
  const configCalculo = { comision_mp_vigente: comisionVigente, retencion_iibb_porcentaje: retencionPct };
  // La comisión de MP solo existe en el pago online: sin la reserva web activa
  // no se muestra el cálculo ni se sugiere nada (la seña por WhatsApp es una
  // transferencia bancaria).
  const conCalculo = reservaOnlineActiva && comisionVigente != null;
  const desglose = reservaOnlineActiva && montoFijo !== null ? desgloseSena(montoFijo, configCalculo) : null;
  const porcentajeValido = Number.isFinite(porcentajeElegido) && porcentajeElegido >= 1 && porcentajeElegido <= 100;
  // Igual que la seña real: cubre la comisión y se redondea hacia arriba.
  const montoEjemplo = calcularSena(PRECIO_EJEMPLO, {
    ...configCalculo, sena_tipo: 'porcentaje', sena_porcentaje: porcentajeElegido,
  });
  const desgloseEjemplo = conCalculo && senaTipo === 'porcentaje' && porcentajeValido
    ? desgloseSena(montoEjemplo, configCalculo)
    : null;
  const confirmado = aplicado !== null && senaMonto === aplicado.nuevo;
  const sugerida = reservaOnlineActiva && montoFijo !== null && !confirmado ? senaFijaSugerida(montoFijo, configCalculo) : null;
  const usarSugerida = () => {
    if (sugerida === null) return;
    setAplicado({ anterior: senaMonto, nuevo: String(sugerida) });
    setSenaMonto(String(sugerida));
  };
  const deshacer = () => {
    if (!aplicado) return;
    setSenaMonto(aplicado.anterior);
    setAplicado(null);
  };

  const botonGuardar = (
    <button
      onClick={onGuardar}
      disabled={guardando}
      style={{
        width: '100%', background: colors.primarySolid, borderRadius: 14, padding: 16,
        border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
        opacity: guardando ? 0.6 : 1,
      }}
    >
      {guardando ? t('saving') : t('save')}
    </button>
  );

  if (vistaMp) {
    return (
      <div style={{ padding: '4px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          <button
            type="button"
            aria-label={t('mpBack')}
            onClick={() => setVistaMp(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
          >
            <IconBack />
          </button>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('mpRowTitle')}</h2>
        </div>

        <div style={{ ...filaDivisoriaStyle, borderBottom: 'none', fontSize: 15, color: colors.text }}>
          <span style={{ minWidth: 0 }}>{t('mpCommission')}</span>
          <span style={{ ...montoStyle, fontWeight: 600 }}>
            {t('mpCommissionValue', { rate: comisionVigente != null ? formatearTasa(comisionVigente) : '' })}
          </span>
        </div>
        <div style={{ ...filaDivisoriaStyle, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, color: colors.text }}>{t('mpRetentionTitle')}</div>
            <div style={avisoStyle}>{t('mpRetentionHint')}</div>
          </div>
          <PillToggle value={retiene} onChange={setRetiene} ariaLabel={t('mpRetentionTitle')} />
        </div>

        {retiene && (
          <SheetInput
            label={t('retentionInputLabel')}
            icon={<IconMoney />}
            value={retencion}
            onChange={setRetencion}
            placeholder={t('retentionPlaceholder')}
            type="text"
            inputMode="decimal"
            rightAdornment={<span style={{ fontSize: 15, color: colors.muted }}>%</span>}
          />
        )}
        {errorRetencionMostrado && <p style={errorStyle}>{errorRetencionMostrado}</p>}

        <div style={{ marginBottom: 20 }}>
          <button type="button" aria-expanded={verDonde} onClick={() => setVerDonde(v => !v)} style={enlaceStyle}>
            {verDonde ? t('whereHide') : t('whereShow')}
          </button>
          {verDonde && <p style={{ ...avisoStyle, margin: '8px 0 0' }}>{t('whereBody')}</p>}
        </div>

        {botonGuardar}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button aria-label={t('close')} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      {/* Primero el porqué: sin esto, Mercado Pago y la comisión aparecen de la nada. */}
      {conCalculo && senaTipo !== 'ninguna' && (
        <div style={{ ...calculadoraStyle, gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{t('howItWorksTitle')}</span>
          <span style={{ fontSize: 13.5, color: colors.text, lineHeight: 1.45 }}>{t('howItWorksBody')}</span>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <SegmentedControl
          ariaLabel={t('depositModeLabel')}
          value={senaTipo}
          onChange={setSenaTipo}
          options={[
            { value: 'ninguna', label: t('modeNone') },
            { value: 'porcentaje', label: t('modePercent') },
            { value: 'fijo', label: t('modeFixed') },
          ]}
        />
      </div>

      {senaTipo === 'ninguna' ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...avisoStyle, margin: 0 }}>{t('noneLine')}</p>
          {errorMonto && <p style={{ ...errorStyle, marginTop: 8, marginBottom: 0 }}>{errorMonto}</p>}
        </div>
      ) : senaTipo === 'porcentaje' ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {chips.map(p => {
              const activo = porcentajeElegido === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setSenaPorcentaje(String(p))}
                  style={{
                    flex: '1 1 60px', minHeight: 48, borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    backgroundColor: activo ? colors.primarySolid : colors.surfaceSubtle,
                    color: activo ? '#fff' : colors.subtext,
                  }}
                >
                  {p}%
                </button>
              );
            })}
          </div>
          {errorPorcentajeMostrado && (
            <p style={{ ...errorStyle, marginTop: 0, marginBottom: 12 }}>{errorPorcentajeMostrado}</p>
          )}
          {conCalculo ? (
            <>
              {desgloseEjemplo && (
                <div style={{ ...calculadoraStyle, marginBottom: 0 }}>
                  <span style={avisoStyle}>{t('exampleLabel')}</span>
                  <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleClientLeaves')}</span>
                    <span style={montoGrandeStyle}>{dinero(montoEjemplo)}</span>
                  </div>
                  <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
                    <span style={{ minWidth: 0 }}>{t('exampleMpKeeps')}</span>
                    <span style={montoStyle}>{dinero(desgloseEjemplo.cargo)}</span>
                  </div>
                  {desgloseEjemplo.retencion > 0 && (
                    <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
                      <span style={{ minWidth: 0 }}>{t('fixedRetention')}</span>
                      <span style={montoStyle}>{dinero(desgloseEjemplo.retencion)}</span>
                    </div>
                  )}
                  <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleNet')}</span>
                    <span style={llegaStyle}>{dinero(desgloseEjemplo.llega)}</span>
                  </div>
                  <span style={avisoStyle}>
                    {t('exampleCovers', { pct: porcentajeElegido, monto: `$${formatMontoEntero((PRECIO_EJEMPLO * porcentajeElegido) / 100)}` })}
                  </span>
                </div>
              )}
              <p style={{ ...avisoStyle, margin: '12px 0 0' }}>{t('percentRounding')}</p>
            </>
          ) : (
            <p style={{ ...avisoStyle, margin: 0 }}>{t('percentOfPrice')}</p>
          )}
        </div>
      ) : (
        <>
          <SheetInput
            label={t('fixedAmountLabel')}
            icon={<IconMoney />}
            value={senaMonto}
            onChange={setSenaMonto}
            placeholder="0"
            type="text"
            inputMode="decimal"
          />
          {errorMonto && <p style={errorStyle}>{errorMonto}</p>}

          {desglose && (
            <div style={calculadoraStyle}>
              <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, color: colors.subtext }}>{t('fixedNet')}</span>
                <span style={{ ...llegaStyle, fontSize: 26 }}>{dinero(desglose.llega)}</span>
              </div>
              <button type="button" aria-expanded={verDetalle} onClick={() => setVerDetalle(v => !v)} style={{ ...enlaceStyle, alignSelf: 'flex-start' }}>
                {verDetalle ? t('hideDetail') : t('showDetail')}
              </button>
              {verDetalle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <div style={{ ...filaStyle, fontSize: 14, fontWeight: 700, color: colors.text }}>
                    <span style={{ minWidth: 0 }}>{t('fixedClientPays')}</span>
                    <span style={montoStyle}>{dinero(desglose.sena)}</span>
                  </div>
                  <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
                    <span style={{ minWidth: 0 }}>{t('fixedMpFee', { rate: formatearTasa(comisionVigente!) })}</span>
                    <span style={montoStyle}>{`−${dinero(desglose.cargo)}`}</span>
                  </div>
                  {desglose.retencion > 0 && (
                    <div style={{ ...filaStyle, fontSize: 14, color: colors.subtext }}>
                      <span style={{ minWidth: 0 }}>{t('fixedRetention')}</span>
                      <span style={montoStyle}>{`−${dinero(desglose.retencion)}`}</span>
                    </div>
                  )}
                  <div style={{ height: 1, backgroundColor: colors.border }} />
                  <div style={{ ...filaStyle, fontSize: 15, fontWeight: 700, color: colors.text }}>
                    <span style={{ minWidth: 0 }}>{t('fixedNet')}</span>
                    <span style={{ ...montoStyle, fontSize: 17 }}>{dinero(desglose.llega)}</span>
                  </div>
                  <span style={avisoStyle}>{t('fixedCostNote')}</span>
                </div>
              )}
            </div>
          )}

          {sugerida !== null && (
            <button type="button" onClick={usarSugerida} style={pildoraStyle}>
              {t('suggestUse', { sena: dinero(sugerida), monto: dinero(montoFijo!) })}
            </button>
          )}
          {confirmado && aplicado && (
            <p style={{ ...avisoStyle, margin: '0 0 12px' }}>
              {t('fixedApplied', { monto: dinero(parsearMonto(aplicado.anterior) ?? 0) })}
              {' · '}
              <button type="button" onClick={deshacer} style={{ ...enlaceStyle, fontSize: 12.5 }}>
                {t('fixedUndo')}
              </button>
            </p>
          )}
        </>
      )}

      {conCalculo && (
        <div style={{ marginBottom: 16 }}>
          <div style={filaDivisoriaStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{t('mpRowTitle')}</div>
              <div style={avisoStyle}>
                {t('mpRowCommission', { rate: formatearTasa(comisionVigente!) })}
                {retiene ? t('mpRowRetention', { retencion: retencionPct.toLocaleString('es-AR', { maximumFractionDigits: 2 }) }) : ''}
              </div>
            </div>
            <button type="button" onClick={() => setVistaMp(true)} style={enlaceStyle}>{t('mpEdit')}</button>
          </div>
          {errorRetencionMostrado && <p style={{ ...errorStyle, marginTop: 8, marginBottom: 0 }}>{errorRetencionMostrado}</p>}
        </div>
      )}

      <p style={{ ...avisoStyle, margin: '0 0 20px' }}>
        {t('transferHint')}{' '}
        {onIrAMensajes ? (
          <button type="button" onClick={onIrAMensajes} style={{ ...enlaceStyle, fontSize: 12.5 }}>
            {t('goToMensajes')}
          </button>
        ) : (
          <span>{t('goToMensajes')}</span>
        )}
      </p>

      {botonGuardar}
    </div>
  );
}
