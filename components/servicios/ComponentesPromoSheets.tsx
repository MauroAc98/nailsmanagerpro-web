'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { SelectorServicios } from '@/components/SelectorServicios';
import { NAV_CLEARANCE } from '@/constants/layout';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { formatearDiasAtencion } from '@/lib/formatearDiasAtencion';
import { useAbreviaturasDias } from '@/hooks/useAbreviaturasDias';
import type { Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';

// Avatar de una persona del equipo: foto si la hay, si no iniciales sobre su color.
export function PersonaAvatar({ profesional, size }: { profesional: Profesional; size: number }) {
  const color = profesional.color || colors.primary;
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 30 ? 13 : 10, fontWeight: 800,
      backgroundColor: withAlpha(color, '26'), color,
    }}>
      {profesional.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profesional.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        inicialesProfesional(profesional.nombre, profesional.apellido)
      )}
    </span>
  );
}

// Bottom sheet montado solo mientras está abierto (el padre decide), con un
// fondo que cierra al tocarlo; arrastrarlo hacia abajo también lo cierra.
function Sheet({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 39, backgroundColor: 'rgba(43, 34, 38, 0.40)' }}
      />
      <BottomSheet
        snapPoints={[0.7]}
        initialIndex={0}
        enablePanDownToClose
        bottomOffset={NAV_CLEARANCE}
        onChange={index => { if (index < 0) onClose(); }}
      >
        <div role="dialog" aria-label={title} style={{ padding: '4px 20px 24px' }}>
          <p style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 20, color: colors.textStrong, margin: 0 }}>{title}</p>
          {subtitle && <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: colors.subtext }}>{subtitle}</p>}
          {children}
        </div>
      </BottomSheet>
    </>
  );
}

export function ElegirServicioSheet({ servicios, selectedId, onSelect, onClose }: {
  servicios: Servicio[]; selectedId: number | null; onSelect: (id: number) => void; onClose: () => void;
}) {
  const t = useTranslations('configuracion.ComponentesPromoSection');
  return (
    <Sheet title={t('serviceSheetTitle')} onClose={onClose}>
      <SelectorServicios
        servicios={servicios}
        mode="single"
        hideAll
        selectedIds={selectedId === null ? [] : [selectedId]}
        onChange={ids => { if (ids.length > 0) onSelect(ids[0]); }}
      />
    </Sheet>
  );
}

export function ElegirPersonaSheet({ servicio, personas, selectedId, sinHorarios, onSelect, onClose }: {
  servicio: Servicio; personas: Profesional[]; selectedId: number | null; sinHorarios: (id: number) => boolean;
  onSelect: (id: number) => void; onClose: () => void;
}) {
  const t = useTranslations('configuracion.ComponentesPromoSection');
  const tProf = useTranslations('configuracion.ProfesionalesPage');
  const abreviaturas = useAbreviaturasDias();
  return (
    <Sheet title={t('personSheetTitle', { servicio: servicio.nombre })} subtitle={t('personSheetHint')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {personas.map(p => {
          const selected = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                borderRadius: 14, padding: '12px 14px', boxShadow: selected ? 'none' : shadows.card,
                border: selected ? `1.5px solid ${colors.primarySolid}` : `1px solid ${colors.border}`,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <PersonaAvatar profesional={p} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: colors.textStrong }}>{p.nombre_completo || p.nombre}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: colors.subtext }}>
                  {formatearDiasAtencion(p.dias_atencion ?? null, abreviaturas, tProf('allDays'), tProf('dayRangeConnector'))}
                </span>
              </span>
              {sinHorarios(p.id) && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: colors.subtext, backgroundColor: colors.surface2,
                  borderRadius: 10, padding: '4px 9px', whiteSpace: 'nowrap',
                }}>
                  {t('noHorariosTag')}
                </span>
              )}
              {selected && <Check size={20} strokeWidth={3} color={colors.primarySolid} />}
            </button>
          );
        })}
      </div>
      <p style={{ margin: '14px 2px 0', fontSize: 12, color: colors.subtext, lineHeight: 1.4 }}>{t('noHorariosFootnote')}</p>
    </Sheet>
  );
}
