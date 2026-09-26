'use client';

import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import SelectorProfesional from '@/components/SelectorProfesional';
import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';
import { profesionalesQueOfrecen, type ComponenteDraft } from '@/lib/promoComponentes';

interface Props {
  componentes: ComponenteDraft[];
  onChange: (next: ComponenteDraft[]) => void;
  // Already filtered by the caller to the services that can be components.
  servicios: Servicio[];
  profesionales: Profesional[];
}

// "Servicios que incluye" section of a promo. Controlled and presentational:
// the page owns the draft and the save flow. Every row = one service + the
// professional who performs it (only professionals who offer that service).
export default function ComponentesPromoSection({ componentes, onChange, servicios, profesionales }: Props) {
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

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, marginBottom: 7, display: 'block', marginLeft: 2 }}>
        {t('title')}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {componentes.map((fila, index) => {
          const ofrecen = profesionalesQueOfrecen(fila.servicioId, profesionales);
          return (
            <div key={index} style={{
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 12, padding: '12px 12px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
    </div>
  );
}
