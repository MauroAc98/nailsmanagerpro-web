'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
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
  // Si viene, el enlace a los datos de transferencia abre esa hoja; si no, es texto.
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
// El resultado dentro de la opción elegida: tarjeta blanca sobre el fondo suave de la opción.
const calculadoraEnOpcionStyle = {
  backgroundColor: colors.surface, borderRadius: 14, padding: 12,
  display: 'flex', flexDirection: 'column', gap: 8,
} as const;
const dejanStyle = { ...montoStyle, fontSize: 20, fontWeight: 700, color: colors.text, fontVariantNumeric: 'tabular-nums' } as const;
const llegaStyle = { ...montoStyle, fontSize: 20, fontWeight: 700, color: colors.success, fontVariantNumeric: 'tabular-nums' } as const;
const consejoStyle = {
  backgroundColor: colors.amberBg, color: colors.amberFg, borderRadius: 14, padding: 14, marginBottom: 16,
  display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.4,
} as const;
const consejoBotonStyle = {
  width: '100%', minHeight: 44, borderRadius: 12, cursor: 'pointer', padding: '8px 16px',
  backgroundColor: 'transparent', border: `1px solid ${colors.amberFg}`, color: colors.amberFg,
  fontSize: 14, fontWeight: 700,
} as const;
const filaDivisoriaStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '12px 0', borderTop: `1px solid ${colors.hairline}`, borderBottom: `1px solid ${colors.hairline}`,
} as const;
const tituloSeccionStyle = { margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: colors.text } as const;

function formatearTasa(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Una de las tres formas de cobrar la seña: el botón (radio) lleva el nombre y
// una línea que explica qué significa; lo que se configura en esa opción (chips,
// monto) va debajo, fuera del radio, porque un radio no puede contener controles.
function OpcionSena({ nombre, descripcion, activa, onElegir, children }: {
  nombre: string;
  descripcion: string;
  activa: boolean;
  onElegir: () => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div
      style={{
        border: `1px solid ${activa ? colors.primarySolid : colors.border}`,
        backgroundColor: activa ? colors.primarySoft : 'transparent',
        borderRadius: 14, overflow: 'hidden',
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        aria-labelledby={`${id}-nombre`}
        aria-describedby={`${id}-desc`}
        onClick={onElegir}
        style={{
          width: '100%', minHeight: 48, display: 'grid', gridTemplateColumns: '22px 1fr', columnGap: 10, rowGap: 2,
          alignItems: 'start', textAlign: 'left', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 18, height: 18, borderRadius: '50%', marginTop: 1, boxSizing: 'border-box',
            border: `2px solid ${activa ? colors.primarySolid : colors.border}`,
            background: activa ? `radial-gradient(circle, ${colors.primarySolid} 45%, transparent 50%)` : 'transparent',
          }}
        />
        <span id={`${id}-nombre`} style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{nombre}</span>
        <span id={`${id}-desc`} style={{ gridColumn: 2, ...avisoStyle }}>{descripcion}</span>
      </button>
      {activa && children ? (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      ) : null}
    </div>
  );
}

export function SheetSenaYPagos({
  senaTipo, setSenaTipo, senaPorcentaje, setSenaPorcentaje, porcentajeGuardado,
  senaMonto, setSenaMonto, error, errorPorcentaje, erroresServidor,
  retiene, setRetiene, retencion, setRetencion, errorRetencion, comisionVigente,
  reservaOnlineActiva, onIrAMensajes, onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetSenaYPagos');
  const idPregunta = useId();
  // Tras aplicar la sugerencia: monto previo y el aplicado, para poder deshacer.
  const [aplicado, setAplicado] = useState<{ anterior: string; nuevo: string } | null>(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const errorMonto = error ?? erroresServidor?.sena_monto;
  const errorPorcentajeMostrado = errorPorcentaje ?? erroresServidor?.sena_porcentaje;
  const errorRetencionMostrado = errorRetencion ?? erroresServidor?.retencion_iibb_porcentaje;
  // Vista de "Más opciones" dentro de la misma hoja (impuestos y transferencia por
  // WhatsApp). Si ya hay un error de retención al abrir, arranca ahí para que se
  // vea; si aparece después (validación al guardar), también se muestra bajo la
  // fila de la vista principal.
  const [vistaMas, setVistaMas] = useState(Boolean(errorRetencionMostrado));
  const [verDonde, setVerDonde] = useState(false);
  const chips = porcentajeGuardado != null && !PORCENTAJES_PREDEFINIDOS.includes(porcentajeGuardado)
    ? [...PORCENTAJES_PREDEFINIDOS, porcentajeGuardado]
    : PORCENTAJES_PREDEFINIDOS;
  const porcentajeElegido = Number(senaPorcentaje.replace(',', '.'));

  // Cálculo de la seña: lo que dejan los clientes, lo que cobra MP y lo que llega,
  // más una seña sugerida que cubre el costo (redondeada hacia arriba a múltiplos de 500 o 1000).
  const dinero = (n: number) => `$${formatMonto(n)}`;
  // Sin centavos cuando el monto es redondo ("$3.000"): lo usan las frases que explican el extra del redondeo.
  const montoCorto = (n: number) => `$${Number.isInteger(n) ? formatMontoEntero(n) : formatMonto(n)}`;
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
  // Lo que le correspondería a la profesional del precio de ejemplo, sin comisión ni redondeo.
  const exactoEjemplo = (PRECIO_EJEMPLO * porcentajeElegido) / 100;
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
  // La sección de Mercado Pago de "Más opciones" existe con la reserva online
  // activa; también si hay un error de retención, para que no quede escondido.
  const mostrarMp = conCalculo || Boolean(errorRetencionMostrado);

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

  const botonDetalle = (
    <button type="button" aria-expanded={verDetalle} onClick={() => setVerDetalle(v => !v)} style={{ ...enlaceStyle, alignSelf: 'flex-start' }}>
      {verDetalle ? t('hideDetail') : t('showDetail')}
    </button>
  );

  if (vistaMas) {
    return (
      <div style={{ padding: '4px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          <button
            type="button"
            aria-label={t('mpBack')}
            onClick={() => setVistaMas(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
          >
            <IconBack />
          </button>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('moreTitle')}</h2>
        </div>

        {mostrarMp && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={tituloSeccionStyle}>{t('mpRowTitle')}</h3>
            {comisionVigente != null && (
              <>
                <div style={{ ...filaStyle, fontSize: 15, color: colors.text, padding: '4px 0' }}>
                  <span style={{ minWidth: 0 }}>{t('mpCommission')}</span>
                  <span style={{ ...montoStyle, fontWeight: 600 }}>{t('mpCommissionValue', { rate: formatearTasa(comisionVigente) })}</span>
                </div>
                <p style={{ ...avisoStyle, margin: '0 0 12px' }}>{t('mpCommissionHint')}</p>
              </>
            )}
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

            <button type="button" aria-expanded={verDonde} onClick={() => setVerDonde(v => !v)} style={enlaceStyle}>
              {verDonde ? t('whereHide') : t('whereShow')}
            </button>
            {verDonde && <p style={{ ...avisoStyle, margin: '8px 0 0' }}>{t('whereBody')}</p>}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <h3 style={tituloSeccionStyle}>{t('transferTitle')}</h3>
          <p style={{ ...avisoStyle, margin: '0 0 8px' }}>{t('transferBody')}</p>
          {onIrAMensajes ? (
            <button type="button" onClick={onIrAMensajes} style={enlaceStyle}>{t('transferLink')}</button>
          ) : (
            <span style={{ ...enlaceStyle, cursor: 'default' }}>{t('transferLink')}</span>
          )}
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

      <div id={idPregunta} style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 10 }}>
        {t('depositModeLabel')}
      </div>
      <div role="radiogroup" aria-labelledby={idPregunta} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <OpcionSena
          nombre={t('modeNone')}
          descripcion={t('modeNoneDesc')}
          activa={senaTipo === 'ninguna'}
          onElegir={() => setSenaTipo('ninguna')}
        />
        <OpcionSena
          nombre={t('modePercent')}
          descripcion={conCalculo ? t('modePercentDescMp') : t('modePercentDesc')}
          activa={senaTipo === 'porcentaje'}
          onElegir={() => setSenaTipo('porcentaje')}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
            <p style={{ ...errorStyle, margin: 0 }}>{errorPorcentajeMostrado}</p>
          )}
          {conCalculo ? (
            <>
              {desgloseEjemplo && (
                <div style={calculadoraEnOpcionStyle}>
                  <span style={avisoStyle}>{t('exampleLabel')}</span>
                  <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleClientLeaves')}</span>
                    <span style={dejanStyle}>{dinero(montoEjemplo)}</span>
                  </div>
                  <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleNet')}</span>
                    <span style={llegaStyle}>{dinero(desgloseEjemplo.llega)}</span>
                  </div>
                  {botonDetalle}
                  {verDetalle && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
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
                    </div>
                  )}
                </div>
              )}
              {desgloseEjemplo && (
                <p style={{ ...avisoStyle, margin: 0 }}>
                  {/* Si el redondeo deja de más, se dice: si no, "te llega el 30 %" y la cifra de arriba no cierran. */}
                  {desgloseEjemplo.llega > exactoEjemplo
                    ? t('exampleCoversExtra', {
                        pct: porcentajeElegido,
                        monto: montoCorto(exactoEjemplo),
                        extra: montoCorto(desgloseEjemplo.llega - exactoEjemplo),
                      })
                    : t('exampleCovers', { pct: porcentajeElegido, monto: montoCorto(exactoEjemplo) })}
                </p>
              )}
            </>
          ) : (
            <p style={{ ...avisoStyle, margin: 0 }}>{t('percentOfPrice')}</p>
          )}
        </OpcionSena>
        <OpcionSena
          nombre={t('modeFixed')}
          descripcion={conCalculo ? t('modeFixedDescMp') : t('modeFixedDesc')}
          activa={senaTipo === 'fijo'}
          onElegir={() => setSenaTipo('fijo')}
        >
          <SheetInput
            label={t('fixedAmountLabel')}
            icon={<IconMoney />}
            value={senaMonto}
            onChange={setSenaMonto}
            placeholder="0"
            type="text"
            inputMode="decimal"
          />
          {errorMonto && <p style={{ ...errorStyle, margin: 0 }}>{errorMonto}</p>}
          {desglose && (
            <div style={calculadoraEnOpcionStyle}>
              <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleClientLeaves')}</span>
                <span style={dejanStyle}>{dinero(desglose.sena)}</span>
              </div>
              <div style={{ ...filaStyle, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, color: colors.subtext }}>{t('exampleNet')}</span>
                <span style={llegaStyle}>{dinero(desglose.llega)}</span>
              </div>
              {botonDetalle}
              {verDetalle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
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
                  <span style={avisoStyle}>{t('fixedCostNote')}</span>
                </div>
              )}
            </div>
          )}
          {sugerida !== null && (
            <div style={consejoStyle}>
              <span>{t('tipFixed', { monto: dinero(montoFijo!), sena: dinero(sugerida) })}</span>
              <button type="button" onClick={usarSugerida} style={consejoBotonStyle}>
                {t('tipUse', { sena: dinero(sugerida) })}
              </button>
            </div>
          )}
          {confirmado && aplicado && (
            <>
              <p style={{ ...avisoStyle, margin: 0 }}>
                {t('fixedApplied', { monto: dinero(parsearMonto(aplicado.anterior) ?? 0) })}
                {' · '}
                <button type="button" onClick={deshacer} style={{ ...enlaceStyle, fontSize: 12.5 }}>
                  {t('fixedUndo')}
                </button>
              </p>
              {/* El redondeo hace que llegue más de lo pedido: se dice, para que las cifras no parezcan un error. */}
              {desglose && desglose.llega > (parsearMonto(aplicado.anterior) ?? 0) && (
                <p style={{ ...avisoStyle, margin: 0 }}>
                  {t('fixedRoundedNote', {
                    querido: montoCorto(parsearMonto(aplicado.anterior) ?? 0),
                    extra: montoCorto(desglose.llega - (parsearMonto(aplicado.anterior) ?? 0)),
                  })}
                </p>
              )}
            </>
          )}
        </OpcionSena>
      </div>
      {errorMonto && senaTipo === 'ninguna' && (
        <p style={{ ...errorStyle, marginTop: -4 }}>{errorMonto}</p>
      )}

      {senaTipo !== 'ninguna' && (
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setVistaMas(true)}
            style={{
              ...filaDivisoriaStyle, width: '100%', background: 'none', textAlign: 'left', cursor: 'pointer',
              borderLeft: 'none', borderRight: 'none',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: colors.text }}>{t('moreTitle')}</span>
              <span style={{ display: 'block', ...avisoStyle }}>{conCalculo ? t('moreSubMp') : t('moreSubTransfer')}</span>
            </span>
            <span aria-hidden="true" style={{ color: colors.muted, fontSize: 18 }}>›</span>
          </button>
          {errorRetencionMostrado && <p style={{ ...errorStyle, marginTop: 8, marginBottom: 0 }}>{errorRetencionMostrado}</p>}
        </div>
      )}

      {botonGuardar}
    </div>
  );
}
