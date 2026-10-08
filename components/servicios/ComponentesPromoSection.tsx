'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Info, Plus, X } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { formatMonto } from '@/lib/money';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import { useHorariosCargados } from '@/hooks/useHorariosCargados';
import { ElegirPersonaSheet, ElegirServicioSheet, PersonaAvatar } from '@/components/servicios/ComponentesPromoSheets';
import type { ModoPromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { ahorroPromo, moverFila, problemasDeFila, profesionalesQueOfrecen, type ComponenteDraft, type ProblemaFila } from '@/lib/promoComponentes';

interface Props {
  componentes: ComponenteDraft[];
  onChange: (next: ComponenteDraft[]) => void;
  // Already filtered by the caller to the services that can be components.
  servicios: Servicio[];
  profesionales: Profesional[];
  // Save-time 422 errors by row — the page owns the mapping. Only a neutral
  // line is shown per row: the backend text is never printed.
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
  // Called right before leaving to Horarios, so the page can keep its draft.
  onBeforeNavigate?: () => void;
}

// "Servicios que incluye" section of a promo. Controlled and presentational:
// the page owns the draft and the save flow. Every row = one service + the
// person who performs it (only people who offer that service), picked from
// bottom sheets opened off each card.
export default function ComponentesPromoSection({
  componentes, onChange, servicios, profesionales, problemas, modo, onModoChange, paraleloHabilitado, modoError,
  duracionDerivada, sumaComponentes, precioComponentes, onPrecioComponentesChange, onBeforeNavigate,
}: Props) {
  const t = useTranslations('configuracion.ComponentesPromoSection');
  const locale = useLocale();
  const router = useRouter();
  // Which card has a picker sheet open (index).
  const [sheetServicio, setSheetServicio] = useState<number | null>(null);
  const [sheetPersona, setSheetPersona] = useState<number | null>(null);

  // Persons with no active horarios loaded: shown as a calm note, never blocking.
  const idsPersonas = [
    ...componentes.flatMap(c => (c.profesionalId === null ? [] : [c.profesionalId])),
    ...(sheetPersona !== null && componentes[sheetPersona]
      ? profesionalesQueOfrecen(componentes[sheetPersona].servicioId, profesionales).map(p => p.id)
      : []),
  ];
  const horariosCargados = useHorariosCargados(idsPersonas);
  const sinHorarios = (id: number | null) => id !== null && horariosCargados[id] === false;

  const servicioDe = (id: number | null) => (id === null ? undefined : servicios.find(s => s.id === id));
  const personaDe = (id: number | null) => (id === null ? undefined : profesionales.find(p => p.id === id));

  const actualizar = (index: number, fila: ComponenteDraft) =>
    onChange(componentes.map((c, i) => (i === index ? fila : c)));

  const elegirServicio = (index: number, servicioId: number | null) => {
    const ofrecen = profesionalesQueOfrecen(servicioId, profesionales);
    const actual = componentes[index].profesionalId;
    // One candidate = nothing to decide; otherwise keep the previous pick
    // only if that person still offers the new service.
    const profesionalId = ofrecen.length === 1
      ? ofrecen[0].id
      : ofrecen.some(p => p.id === actual) ? actual : null;
    actualizar(index, { servicioId, profesionalId });
    setSheetServicio(null);
  };

  const quitar = (index: number) => onChange(componentes.filter((_, i) => i !== index));
  const mover = (index: number, delta: -1 | 1) => onChange(moverFila(componentes, index, delta));

  // One plain sentence under the mode control, naming who attends.
  const nombres = componentes.flatMap(c => {
    const p = personaDe(c.profesionalId);
    return p ? [p.nombre] : [];
  });
  const frase = nombres.length < 2 ? null
    : modo === 'paralelo'
      ? t('modeParallelSentence', { nombres: new Intl.ListFormat(locale, { type: 'conjunction' }).format([...new Set(nombres)]) })
      : t('modeSequentialSentence', { nombres: nombres.join(t('sequenceSeparator')) });

  const hayServicios = componentes.some(c => c.servicioId !== null);
  const precioMostrado = precioComponentes.trim() && !Number.isNaN(parseFloat(precioComponentes))
    ? parseFloat(precioComponentes) : sumaComponentes;
  const ahorro = ahorroPromo(sumaComponentes, precioComponentes);
  const enlaceStyle = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: colors.primaryDeep,
  } as const;
  const eyebrow = { margin: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted } as const;
  const sheetServicioAbierto = sheetServicio !== null ? componentes[sheetServicio] : undefined;
  const sheetPersonaAbierto = sheetPersona !== null ? componentes[sheetPersona] : undefined;
  const servicioDeSheetPersona = servicioDe(sheetPersonaAbierto?.servicioId ?? null);

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginBottom: 3, display: 'block', marginLeft: 2 }}>
        {t('title')}
      </label>
      <p style={{ margin: '0 0 10px 2px', fontSize: 12.5, color: colors.subtext, lineHeight: 1.4 }}>{t('intro')}</p>

      {/* Modo: control segmentado; paralelo solo si el ajuste del salón lo habilita. */}
      <div style={{ display: 'flex', backgroundColor: colors.surface2, borderRadius: 12, padding: 3, marginBottom: 6 }}>
        {(['secuencia', 'paralelo'] as const).map(m => {
          const selected = modo === m;
          const disabled = m === 'paralelo' && !paraleloHabilitado;
          const fill = selected ? colors.primarySolid : colors.muted;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onModoChange(m)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 6px', borderRadius: 10, fontSize: 13, fontWeight: selected ? 700 : 600, border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                backgroundColor: selected ? colors.surface : 'transparent',
                boxShadow: selected ? shadows.card : 'none',
                color: selected ? colors.textStrong : colors.subtext,
              }}
            >
              <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
                {m === 'secuencia' ? (
                  <><rect x="0" y="0" width="10" height="5" rx="2" fill={fill} /><rect x="11" y="7" width="10" height="5" rx="2" fill={fill} /></>
                ) : (
                  <><rect x="0" y="0" width="20" height="5" rx="2" fill={fill} /><rect x="0" y="7" width="20" height="5" rx="2" fill={fill} /></>
                )}
              </svg>
              {t(m === 'paralelo' ? 'modeParallel' : 'modeSequential')}
            </button>
          );
        })}
      </div>
      {frase && <p style={{ margin: '0 0 12px 2px', fontSize: 12.5, color: colors.subtext }}>{frase}</p>}
      {!paraleloHabilitado && (
        <p style={{ margin: '0 0 10px 2px', fontSize: 12, color: colors.subtext }}>{t('modeParallelDisabledHint')}</p>
      )}
      {modoError && (
        <p style={{ margin: '0 0 10px 2px', fontSize: 12, color: colors.dangerBorder }}>{modoError}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {componentes.map((fila, index) => {
          const servicio = servicioDe(fila.servicioId);
          const persona = personaDe(fila.profesionalId);
          const ofrecen = profesionalesQueOfrecen(fila.servicioId, profesionales);
          const problemasFila = problemasDeFila(problemas, index);
          return (
            <div key={index} style={{
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 14, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {modo === 'secuencia' && (
                  <span aria-label={t('orderLabel', { n: index + 1 })} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 24, height: 24, borderRadius: 12, fontSize: 12, fontWeight: 700,
                    backgroundColor: colors.surface2, color: colors.subtext,
                  }}>
                    {index + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSheetServicio(index)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', padding: 0, background: 'none', border: 'none' }}
                >
                  <span style={{
                    display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis', color: servicio ? colors.textStrong : colors.primaryDeep,
                  }}>
                    {servicio ? servicio.nombre : t('servicePlaceholder')}
                  </span>
                  {servicio && (
                    <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: colors.muted }}>
                      {servicio.precio !== null
                        ? t('serviceMeta', { duracion: formatearDuracion(servicio.duracion_minutos), precio: `$${formatMonto(parseFloat(servicio.precio))}` })
                        : formatearDuracion(servicio.duracion_minutos)}
                    </span>
                  )}
                </button>
                {modo === 'secuencia' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <button
                      type="button"
                      aria-label={t('moveUp')}
                      disabled={index === 0}
                      onClick={() => mover(index, -1)}
                      style={{
                        display: 'flex', width: 22, height: 16, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'transparent', border: 'none', color: colors.muted,
                        cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.4 : 1,
                      }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('moveDown')}
                      disabled={index === componentes.length - 1}
                      onClick={() => mover(index, 1)}
                      style={{
                        display: 'flex', width: 22, height: 16, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'transparent', border: 'none', color: colors.muted,
                        cursor: index === componentes.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === componentes.length - 1 ? 0.4 : 1,
                      }}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={t('remove')}
                  onClick={() => quitar(index)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 28, height: 28, cursor: 'pointer', backgroundColor: 'transparent', border: 'none', color: colors.muted,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              {fila.servicioId !== null && ofrecen.length === 0 && (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.warningFg }}>{t('noProfesional')}</p>
              )}
              {ofrecen.length > 0 && (
                <>
                  <div style={{ height: 1, backgroundColor: colors.hairline, margin: '12px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {persona ? (
                      <>
                        <PersonaAvatar profesional={persona} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={eyebrow}>{t('whoLabel')}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 600, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {persona.nombre_completo || persona.nombre}
                          </p>
                        </div>
                        <button type="button" aria-label={t('changePersonAria')} onClick={() => setSheetPersona(index)} style={enlaceStyle}>
                          {t('change')}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setSheetPersona(index)} style={{ ...enlaceStyle, flex: 1, textAlign: 'left' }}>
                        {t('choosePerson')}
                      </button>
                    )}
                  </div>
                </>
              )}
              {persona && sinHorarios(persona.id) && (
                <div style={{ display: 'flex', gap: 10, backgroundColor: colors.surface2, borderRadius: 10, padding: '11px 12px', marginTop: 12 }}>
                  <Info size={18} color={colors.subtext} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text }}>{t('noHorariosTitle', { nombre: persona.nombre })}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12.5, color: colors.subtext, lineHeight: 1.4 }}>{t('noHorariosBody')}</p>
                    <button type="button" onClick={() => { onBeforeNavigate?.(); router.push(`/configuracion/slots?profesional=${persona.id}`); }} style={{ ...enlaceStyle, marginTop: 7, fontWeight: 700 }}>
                      {t('loadHorarios')}
                    </button>
                  </div>
                </div>
              )}
              {problemasFila.length > 0 && (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.dangerBorder }}>{t('rowError')}</p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange([...componentes, { servicioId: null, profesionalId: null }])}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: 14,
            padding: '13px 16px', fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
          }}
        >
          <Plus size={16} />{t('add')}
        </button>
      </div>

      {hayServicios && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 16, backgroundColor: colors.surface2, borderRadius: 14, padding: '13px 16px' }}>
            <div style={{ flex: 1 }}>
              <p style={eyebrow}>{t('totalDuration')}</p>
              <p style={{ margin: '3px 0 0', fontFamily: agendaFontSerif, fontSize: 20, color: colors.textStrong }}>
                {formatearDuracion(duracionDerivada)}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={eyebrow}>{t('totalPrice')}</p>
              <p style={{ margin: '3px 0 0', fontFamily: agendaFontSerif, fontSize: 20, color: colors.textStrong }}>
                {`$${formatMonto(precioMostrado)}`}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: colors.subtext }}>
                {t('priceSumLabel')}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label htmlFor="precioComponentes" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginBottom: 7, display: 'block', marginLeft: 2 }}>
              {t('priceLabel')}
            </label>
            <input
              id="precioComponentes"
              type="number"
              inputMode="decimal"
              placeholder={String(sumaComponentes)}
              value={precioComponentes}
              onChange={e => onPrecioComponentesChange(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 14, color: colors.text,
              }}
            />
            <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.subtext }}>
              {ahorro > 0
                ? t('priceSavings', { suma: `$${formatMonto(sumaComponentes)}`, ahorro: `$${formatMonto(ahorro)}` })
                : t('priceSumOnly', { suma: `$${formatMonto(sumaComponentes)}` })}
            </p>
          </div>
        </div>
      )}

      {sheetServicio !== null && sheetServicioAbierto && (
        <ElegirServicioSheet
          servicios={servicios}
          selectedId={sheetServicioAbierto.servicioId}
          onSelect={id => elegirServicio(sheetServicio, id)}
          onClose={() => setSheetServicio(null)}
        />
      )}
      {sheetPersona !== null && sheetPersonaAbierto && servicioDeSheetPersona && (
        <ElegirPersonaSheet
          servicio={servicioDeSheetPersona}
          personas={profesionalesQueOfrecen(sheetPersonaAbierto.servicioId, profesionales)}
          selectedId={sheetPersonaAbierto.profesionalId}
          sinHorarios={id => sinHorarios(id)}
          onSelect={id => {
            actualizar(sheetPersona, { ...sheetPersonaAbierto, profesionalId: id });
            setSheetPersona(null);
          }}
          onClose={() => setSheetPersona(null)}
        />
      )}
    </div>
  );
}
