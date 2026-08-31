'use client';

import { useState } from 'react';
import type { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import type { Servicio } from '@/services/servicioService';

// Picker de servicios (buscador + chips de seleccionados + acordeón
// Servicios/Promociones) compartido entre agenda/nuevo y agenda/[id] —
// antes duplicado casi línea por línea en ambas pantallas, lo que ya
// permitió que se desincronizaran una vez (una tenía el mensaje de
// "profesional sin servicios asignados" y la otra no).
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

interface Props {
  t: ReturnType<typeof useTranslations>;
  mostrarSelectorProfesional: boolean;
  hayProfesionalSeleccionada: boolean;
  serviciosDisponibles: Servicio[];
  selectedServicioIds: number[];
  onToggleServicio: (id: number) => void;
}

export function ServicioPicker({
  t, mostrarSelectorProfesional, hayProfesionalSeleccionada,
  serviciosDisponibles, selectedServicioIds, onToggleServicio,
}: Props) {
  const [servicioBuscar, setServicioBuscar] = useState('');
  const [grupoServicioAbierto, setGrupoServicioAbierto] = useState<'regulares' | 'promos' | null>('regulares');

  const serviciosFiltrados = serviciosDisponibles.filter(s =>
    s.nombre.toLowerCase().includes(servicioBuscar.toLowerCase())
  );
  const gruposServicios = [
    { key: 'regulares' as const, nombre: t('groupServicios'), items: serviciosFiltrados.filter(s => !s.es_promo) },
    { key: 'promos' as const, nombre: t('groupPromociones'), items: serviciosFiltrados.filter(s => s.es_promo) },
  ].filter(g => g.items.length > 0);
  const serviciosSeleccionados = serviciosDisponibles.filter(s => selectedServicioIds.includes(s.id));

  // grupoServicioAbierto puede quedar apuntando a un grupo que el filtro de
  // texto (o el cambio de profesional) ya vació — sin este fallback, buscar
  // algo que solo está en "Promociones" con "Servicios" todavía seleccionado
  // deja la única fila con resultados colapsada, como si la búsqueda no
  // hubiera encontrado nada. null (usuario cerró todo a propósito) se
  // respeta tal cual.
  const grupoAbiertoEfectivo = grupoServicioAbierto === null
    ? null
    : gruposServicios.some(g => g.key === grupoServicioAbierto)
      ? grupoServicioAbierto
      : (gruposServicios[0]?.key ?? null);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>{t('services')}</p>
        {selectedServicioIds.length > 0 && (
          <span style={{
            borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
            backgroundColor: colors.primarySoft, color: colors.primaryDeep,
          }}>
            {t('selectedCount', { count: selectedServicioIds.length })}
          </span>
        )}
      </div>
      {mostrarSelectorProfesional && !hayProfesionalSeleccionada ? (
        <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px 2px' }}>
          {t('chooseProfessionalFirst')}
        </p>
      ) : serviciosDisponibles.length === 0 ? (
        <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px 2px' }}>
          {t('noServicesAssigned')}
        </p>
      ) : (
        <div style={{
          marginBottom: 20, borderRadius: 16,
          border: `1px solid ${colors.border}`, backgroundColor: colors.surface, overflow: 'hidden',
        }}>
          {/* Buscador */}
          <div style={{ padding: 10, borderBottom: `1px solid ${colors.hairline}`, position: 'relative' }}>
            <Search size={16} strokeWidth={2} color={colors.muted} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={servicioBuscar}
              onChange={e => setServicioBuscar(e.target.value)}
              placeholder={t('filterServices')}
              style={{
                width: '100%', height: 40, borderRadius: 10, border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceSubtle, color: colors.text,
                padding: '0 12px 0 34px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Chips de seleccionados */}
          {serviciosSeleccionados.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, borderBottom: `1px solid ${colors.hairline}` }}>
              {serviciosSeleccionados.map(s => (
                <button
                  key={s.id}
                  onClick={() => onToggleServicio(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 10px',
                    fontSize: 12, fontWeight: 600, color: colors.primaryDeep, backgroundColor: colors.primarySoft,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {s.nombre}
                  <X size={12} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          )}

          {/* Grupos colapsables (regulares / promos) */}
          {gruposServicios.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: colors.subtext, margin: 0 }}>
              {t('noServicesFound')}
            </p>
          ) : gruposServicios.map((grupo, groupIndex) => {
            const isOpen = grupoAbiertoEfectivo === grupo.key;
            const countInGroup = grupo.items.filter(s => selectedServicioIds.includes(s.id)).length;
            return (
              <div key={grupo.key} style={{ borderTop: groupIndex > 0 ? `1px solid ${colors.hairline}` : 'none' }}>
                <button
                  onClick={() => setGrupoServicioAbierto(isOpen ? null : grupo.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.subtext }}>
                    {grupo.nombre}
                    {countInGroup > 0 && (
                      <span style={{
                        borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                        backgroundColor: colors.primarySolid, color: colors.primaryFg,
                      }}>
                        {countInGroup}
                      </span>
                    )}
                  </span>
                  {isOpen ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 8px 8px' }}>
                    {grupo.items.map(s => {
                      const checked = selectedServicioIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onToggleServicio(s.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                            padding: '10px 8px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                            background: 'none', border: 'none',
                          }}
                        >
                          <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            width: 20, height: 20, borderRadius: 6,
                            border: `1px solid ${checked ? colors.primarySolid : colors.border}`,
                            backgroundColor: checked ? colors.primarySolid : 'transparent',
                            color: colors.primaryFg,
                          }}>
                            {checked && <Check size={14} strokeWidth={3} />}
                          </span>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: colors.textStrong,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {s.nombre}
                          </span>
                          <span style={{ fontSize: 12, color: colors.muted, flexShrink: 0 }}>
                            {s.duracion_minutos} min
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
