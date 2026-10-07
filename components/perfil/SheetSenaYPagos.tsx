'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { SegmentedControl } from '@/components/SegmentedControl';
import { parsearMonto } from '@/lib/parsearMonto';
import { desgloseSena, senaFijaSugerida } from '@/lib/senaPreview';
import { SheetInput } from './SheetInput';
import type { SenaCampo, SenaModo } from '@/lib/senaConfig';

const PORCENTAJES_PREDEFINIDOS = [20, 30, 50, 100];

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
  // Retención de impuestos: "No" guarda 0, "Sí" guarda el porcentaje cargado.
  retiene: boolean;
  setRetiene: (v: boolean) => void;
  retencion: string;
  setRetencion: (v: string) => void;
  errorRetencion: string | null;
  // Comisión de MP con IVA (user.comision_mp_vigente); null = no se muestra. Solo se
  // muestra con la reserva online activa (ver reservaOnlineActiva).
  comisionVigente: number | null;
  // La sugerencia de cubrir la comisión solo tiene sentido con la reserva
  // online activa (es donde se cobra la seña por Mercado Pago).
  reservaOnlineActiva: boolean;
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
const preguntaStyle = { fontSize: 13, fontWeight: 600, color: colors.subtext, margin: '0 0 10px' } as const;

const filaStyle = { display: 'flex', justifyContent: 'space-between', gap: 12 } as const;
// El monto nunca se corta: no se achica ni baja de renglón; la etiqueta cede.
const montoStyle = { whiteSpace: 'nowrap', flexShrink: 0 } as const;
const bannerStyle = {
  backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14, marginBottom: 16,
  display: 'flex', flexDirection: 'column', gap: 10,
} as const;
const botonBannerStyle = {
  width: '100%', minHeight: 44, border: 'none', borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 700,
} as const;

function formatearTasa(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function SheetSenaYPagos({
  senaTipo, setSenaTipo, senaPorcentaje, setSenaPorcentaje, porcentajeGuardado,
  senaMonto, setSenaMonto, error, errorPorcentaje, erroresServidor,
  retiene, setRetiene, retencion, setRetencion, errorRetencion, comisionVigente,
  reservaOnlineActiva, onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetSenaYPagos');
  const locale = useLocale();
  // Tras "Usar": monto previo y el aplicado, para poder deshacer.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);
  const errorMonto = error ?? erroresServidor?.sena_monto;
  const errorPorcentajeMostrado = errorPorcentaje ?? erroresServidor?.sena_porcentaje;
  const errorRetencionMostrado = errorRetencion ?? erroresServidor?.retencion_iibb_porcentaje;
  const chips = porcentajeGuardado != null && !PORCENTAJES_PREDEFINIDOS.includes(porcentajeGuardado)
    ? [...PORCENTAJES_PREDEFINIDOS, porcentajeGuardado]
    : PORCENTAJES_PREDEFINIDOS;
  const porcentajeElegido = Number(senaPorcentaje.replace(',', '.'));

  // Cálculo de la seña fija: lo que paga el cliente, lo que cobra MP y lo que
  // llega, más una seña sugerida que cubre el costo (redondeada hacia arriba a 100).
  const numero = locale === 'es' ? 'es-AR' : locale;
  const dinero = (n: number) => `$${new Intl.NumberFormat(numero, { maximumFractionDigits: 2 }).format(n)}`;
  const montoFijo = senaTipo === 'fijo' ? parsearMonto(senaMonto) : null;
  const retencionPct = retiene ? (parsearMonto(retencion) ?? 0) : 0;
  const configCalculo = { comision_mp_vigente: comisionVigente, retencion_iibb_porcentaje: retencionPct };
  // La comisión de MP solo existe en el pago online: sin la reserva web activa
  // no se muestra el desglose ni se sugiere nada (la seña por WhatsApp es una
  // transferencia bancaria).
  const desglose = reservaOnlineActiva && montoFijo !== null ? desgloseSena(montoFijo, configCalculo) : null;
  const confirmado = aplicado !== null && senaMonto === aplicado.nuevo;
  const sugerida = reservaOnlineActiva && montoFijo !== null && !confirmado ? senaFijaSugerida(montoFijo, configCalculo) : null;
  const desgloseSugerida = sugerida !== null ? desgloseSena(sugerida, configCalculo) : null;
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

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>
      <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px', lineHeight: 1.4 }}>
        {t('subtitle')}
      </p>

      <p style={preguntaStyle}>{t('depositModeQuestion')}</p>
      <div style={{ marginBottom: 16 }}>
        <SegmentedControl
          ariaLabel={t('depositModeLabel')}
          value={senaTipo}
          onChange={setSenaTipo}
          options={[
            { value: 'porcentaje', label: t('modePercent') },
            { value: 'fijo', label: t('modeFixed') },
            { value: 'ninguna', label: t('modeNone') },
          ]}
        />
      </div>

      {senaTipo === 'ninguna' ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...avisoStyle, margin: 0 }}>{t('noneHelp')}</p>
          {errorMonto && <p style={{ ...errorStyle, marginTop: 8, marginBottom: 0 }}>{errorMonto}</p>}
        </div>
      ) : senaTipo === 'porcentaje' ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
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
          <p style={{ ...avisoStyle, margin: 0 }}>{t('percentHelp')}</p>
          {errorPorcentajeMostrado && (
            <p style={{ ...errorStyle, marginTop: 8, marginBottom: 0 }}>{errorPorcentajeMostrado}</p>
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
            <div style={{
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14,
              padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
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

          {confirmado && aplicado && (
            <div style={{ ...bannerStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, lineHeight: 1.35, color: colors.text, minWidth: 0 }}>
                {t('fixedApplied', { monto: dinero(parsearMonto(aplicado.anterior) ?? 0) })}
              </span>
              <button type="button" onClick={deshacer} style={{ ...botonBannerStyle, width: 'auto', flexShrink: 0, padding: '0 14px', fontSize: 13 }}>
                {t('fixedUndo')}
              </button>
            </div>
          )}
          {sugerida !== null && desgloseSugerida && montoFijo !== null && (
            <div style={bannerStyle}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.primaryDeep }}>
                {t('fixedSuggestTitle', { monto: dinero(montoFijo) })}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.4, color: colors.text }}>
                {t('fixedSuggestBody', { sena: dinero(sugerida), cargo: dinero(desgloseSugerida.cargo), llega: dinero(desgloseSugerida.llega) })}
              </span>
              <button type="button" onClick={usarSugerida} style={botonBannerStyle}>
                {t('fixedSuggestUse', { sena: dinero(sugerida) })}
              </button>
              <span style={avisoStyle}>{t('fixedSuggestRound')}</span>
            </div>
          )}
        </>
      )}

      <p style={preguntaStyle}>{t('retentionQuestion')}</p>
      <div style={{ marginBottom: 12 }}>
        <SegmentedControl
          ariaLabel={t('retentionQuestion')}
          value={retiene ? 'si' : 'no'}
          onChange={v => setRetiene(v === 'si')}
          options={[
            { value: 'no', label: t('retentionNo') },
            { value: 'si', label: t('retentionYes') },
          ]}
        />
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
      <p style={{ ...avisoStyle, margin: '0 0 16px' }}>{t('retentionHelp')}</p>

      {reservaOnlineActiva && senaTipo === 'porcentaje' && comisionVigente != null && (
        <p style={{ ...avisoStyle, margin: '0 0 16px', padding: '0 2px' }}>
          {t('mpFeeNote', { rate: formatearTasa(comisionVigente) })}
        </p>
      )}

      <div style={{
        backgroundColor: colors.primarySoft, borderRadius: 12, padding: '12px 14px', marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.primaryDeep, lineHeight: 1.4 }}>{t('crosslinkToMensajes')}</p>
      </div>

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
    </div>
  );
}
