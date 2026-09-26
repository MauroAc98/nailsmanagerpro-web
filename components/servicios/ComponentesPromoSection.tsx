'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import SelectorProfesional from '@/components/SelectorProfesional';
import { formatMontoCorto } from '@/lib/money';
import type { ModoPromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { moverFila, profesionalesQueOfrecen, problemasDeFila, type ComponenteDraft, type ProblemaFila } from '@/lib/promoComponentes';

interface Props {
  componentes: ComponenteDraft[];
  onChange: (next: ComponenteDraft[]) => void;
  // Already filtered by the caller to the services that can be components.
  servicios: Servicio[];
  profesionales: Profesional[];
  // Merges backend problemas with save-time 422 mapping — the page owns
  // that union, this component only renders whatever lands on each row.
  problemas: ProblemaFila[];
  modo: ModoPromo;
  onModoChange: (modo: ModoPromo) => void;
  // Studio "atiende en paralelo" setting AND enough active professionals —
  // the page owns both inputs (lib.paraleloDisponible), this component only
  // renders the gate.
  paraleloHabilitado: boolean;
  // paralelo_no_habilitado 422 from the last save attempt, shown next to
  // the mode control instead of falling back to the generic dialog.
  modoError?: string;
  // Live values derived from the catalog (never the promo's own persisted
  // duracion/precio, which can go stale) — the page owns the computation
  // (lib.duracionDerivada/sumaComponentes), this component only displays it.
  duracionDerivada: number;
  sumaComponentes: number;
  precioComponentes: string;
  onPrecioComponentesChange: (value: string) => void;
}

// "Servicios que incluye" section of a promo. Controlled and presentational:
// the page owns the draft and the save flow. Every row = one service + the
// professional who performs it (only professionals who offer that service).
export default function ComponentesPromoSection({
  componentes, onChange, servicios, profesionales, problemas, modo, onModoChange, paraleloHabilitado, modoError,
  duracionDerivada, sumaComponentes, precioComponentes, onPrecioComponentesChange,
}: Props) {
  const t = useTranslations('configuracion.ComponentesPromoSection');

  const actualizar = (index: number, fila: ComponenteDraft) =>
    onChange(componentes.map((c, i) => (i === index ? fila : c)));

  const elegirServicio = (index: number, servicioId: number | null) => {
    const ofrecen = profesionalesQueOfrecen(servicioId, profesionales);
    const actual = componentes[index].profesionalId;
    // One candidate = nothing to decide; otherwise keep the previous pick
    // only if she still offers the new service.
    const profesionalId = ofrecen.length === 1
      ? ofrecen[0].id
      : ofrecen.some(p => p.id === actual) ? actual : null;
    actualizar(index, { servicioId, profesionalId });
  };

  const quitar = (index: number) => onChange(componentes.filter((_, i) => i !== index));
  const mover = (index: number, delta: -1 | 1) => onChange(moverFila(componentes, index, delta));

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginBottom: 7, display: 'block', marginLeft: 2 }}>
        {t('title')}
      </label>

      {/* Modo: paralelo solo si el ajuste del salón lo habilita. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {(['secuencia', 'paralelo'] as const).map(m => {
          const selected = modo === m;
          const disabled = m === 'paralelo' && !paraleloHabilitado;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onModoChange(m)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                backgroundColor: selected ? colors.primarySolid : colors.surface,
                color: selected ? '#fff' : colors.text,
                border: `1px solid ${selected ? colors.primarySolid : colors.border}`,
              }}
            >
              {t(m === 'paralelo' ? 'modeParallel' : 'modeSequential')}
            </button>
          );
        })}
      </div>
      {!paraleloHabilitado && (
        <p style={{ margin: '0 0 10px 2px', fontSize: 12, color: colors.subtext }}>{t('modeParallelDisabledHint')}</p>
      )}
      {modoError && (
        <p style={{ margin: '0 0 10px 2px', fontSize: 12, color: colors.dangerBorder }}>{modoError}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {componentes.map((fila, index) => {
          const ofrecen = profesionalesQueOfrecen(fila.servicioId, profesionales);
          const problemasFila = problemasDeFila(problemas, index);
          return (
            <div key={index} style={{
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 12, padding: '12px 12px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {modo === 'secuencia' && (
                  <span aria-label={t('orderLabel', { n: index + 1 })} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 22, height: 22, borderRadius: 11, fontSize: 12, fontWeight: 700,
                    backgroundColor: colors.surfaceSubtle, color: colors.subtext,
                  }}>
                    {index + 1}
                  </span>
                )}
                <select
                  aria-label={t('serviceLabel')}
                  value={fila.servicioId ?? ''}
                  onChange={e => elegirServicio(index, e.target.value ? Number(e.target.value) : null)}
                  style={{
                    flex: 1, minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis',
                    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: 10, padding: '10px 12px', fontSize: 14, color: colors.text,
                  }}
                >
                  <option value="">{t('servicePlaceholder')}</option>
                  {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                {modo === 'secuencia' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <button
                      type="button"
                      aria-label={t('moveUp')}
                      disabled={index === 0}
                      onClick={() => mover(index, -1)}
                      style={{
                        display: 'flex', width: 22, height: 16, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'transparent', border: 'none', color: colors.subtext,
                        cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.4 : 1,
                      }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('moveDown')}
                      disabled={index === componentes.length - 1}
                      onClick={() => mover(index, 1)}
                      style={{
                        display: 'flex', width: 22, height: 16, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'transparent', border: 'none', color: colors.subtext,
                        cursor: index === componentes.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === componentes.length - 1 ? 0.4 : 1,
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={t('remove')}
                  onClick={() => quitar(index)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                    backgroundColor: 'transparent', border: `1px solid ${colors.border}`, color: colors.subtext,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              {fila.servicioId !== null && ofrecen.length === 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.warningFg }}>{t('noProfesional')}</p>
              )}
              {ofrecen.length > 0 && (
                <SelectorProfesional
                  label={t('whoLabel')}
                  profesionales={ofrecen.map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, color: p.color, avatarUrl: p.avatar_url }))}
                  selectedId={fila.profesionalId}
                  onSelect={id => actualizar(index, { ...fila, profesionalId: id })}
                  toggleable={false}
                />
              )}
              {problemasFila.map((p, i) => (
                <p key={i} style={{ margin: '0 0 12px', fontSize: 12, color: colors.dangerBorder }}>{p.mensaje}</p>
              ))}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange([...componentes, { servicioId: null, profesionalId: null }])}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: 12,
            padding: '12px 16px', fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
          }}
        >
          <Plus size={16} />{t('add')}
        </button>
      </div>

      {componentes.some(c => c.servicioId !== null) && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 10px 2px', fontSize: 13, color: colors.subtext }}>
            {t('durationDerived', { min: duracionDerivada })}
          </p>
          <label htmlFor="precioComponentes" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginBottom: 7, display: 'block', marginLeft: 2 }}>
            {t('priceLabel')}
          </label>
          <input
            id="precioComponentes"
            type="number"
            inputMode="decimal"
            placeholder={t('pricePlaceholder')}
            value={precioComponentes}
            onChange={e => onPrecioComponentesChange(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: 10, padding: '10px 12px', fontSize: 14, color: colors.text,
            }}
          />
          <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.subtext }}>
            {t('priceSumHint', { monto: `$${formatMontoCorto(sumaComponentes)}` })}
          </p>
        </div>
      )}
    </div>
  );
}
