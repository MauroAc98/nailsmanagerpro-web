'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { SheetInput } from './SheetInput';
import type { SenaCampo } from '@/lib/senaConfig';
import { COMISIONES_MP_REFERENCIA, coincideConPorcentaje, porcentajeParaInput } from '@/lib/mpComisiones';

interface Props {
  senaMonto: string;
  setSenaMonto: (v: string) => void;
  // Error de formato local (parsearSenaMonto en perfil/page.tsx), no del
  // guard de negocio — ese llega en erroresServidor.sena_monto.
  error: string | null;
  // 422 del guard de Mercado Pago (reserva online): rechaza vaciar el monto
  // mientras haya una cuenta conectada. Vive acá porque el monto ahora se
  // edita en este sheet, no en Mensajes automáticos.
  erroresServidor?: Partial<Record<SenaCampo, string>>;
  // Porcentajes por negocio, como texto de input. Vacío en comisión = tasa
  // estándar; vacío en retención = 0 (la decisión de sumarla es del negocio).
  retencion: string;
  setRetencion: (v: string) => void;
  comision: string;
  setComision: (v: string) => void;
  errorRetencion: string | null;
  errorComision: string | null;
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

export function SheetSenaYPagos({
  senaMonto, setSenaMonto, error, erroresServidor,
  retencion, setRetencion, comision, setComision, errorRetencion, errorComision, onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetSenaYPagos');
  const errorServidorMonto = erroresServidor?.sena_monto;
  const errorComisionMostrado = errorComision ?? erroresServidor?.comision_mp_porcentaje;
  const errorRetencionMostrado = errorRetencion ?? erroresServidor?.retencion_iibb_porcentaje;

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

      <SheetInput
        label={t('depositAmount')}
        icon={<IconMoney />}
        value={senaMonto}
        onChange={setSenaMonto}
        placeholder="0"
        type="text"
        inputMode="decimal"
      />

      {error && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16 }}>{error}</p>
      )}
      {errorServidorMonto && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16, lineHeight: 1.4 }}>{errorServidorMonto}</p>
      )}

      <SheetInput
        label={t('mpCommission')}
        icon={<IconMoney />}
        value={comision}
        onChange={setComision}
        placeholder={t('mpCommissionPlaceholder')}
        type="text"
        inputMode="decimal"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: -4, marginBottom: 10 }}>
        {COMISIONES_MP_REFERENCIA.map(c => {
          const activo = coincideConPorcentaje(comision, c.porcentaje);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setComision(porcentajeParaInput(c.porcentaje))}
              style={{
                borderRadius: 20, padding: '8px 14px', fontSize: 13, border: 'none', cursor: 'pointer',
                backgroundColor: activo ? colors.primarySolid : colors.border,
                color: activo ? '#fff' : colors.subtext,
              }}
            >
              {t(`mpPlazo.${c.id}`, { rate: porcentajeParaInput(c.porcentaje) })}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: colors.subtext, marginTop: 0, marginBottom: 16, lineHeight: 1.4 }}>{t('mpCommissionHelp')}</p>
      {errorComisionMostrado && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16, lineHeight: 1.4 }}>{errorComisionMostrado}</p>
      )}

      <SheetInput
        label={t('iibbRetention')}
        icon={<IconMoney />}
        value={retencion}
        onChange={setRetencion}
        placeholder="0"
        type="text"
        inputMode="decimal"
      />
      <p style={{ fontSize: 12, color: colors.subtext, marginTop: -8, marginBottom: 16, lineHeight: 1.4 }}>{t('iibbRetentionHelp')}</p>
      {errorRetencionMostrado && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16, lineHeight: 1.4 }}>{errorRetencionMostrado}</p>
      )}

      <div style={{
        backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: colors.text }}>{t('mpInfoTitle')}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: colors.subtext, lineHeight: 1.4 }}>{t('mpInfoBody')}</p>
      </div>

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
