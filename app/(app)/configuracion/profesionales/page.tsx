'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, shadows } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Profesional } from '@/services/profesionalService';
import { NAV_HEIGHT } from '@/constants/layout';
import PillToggle from '@/components/PillToggle';

function ProfesionalCard({
  profesional,
  onEdit,
  onToggle,
}: {
  profesional: Profesional;
  onEdit:      () => void;
  onToggle:    (activo: boolean) => void;
}) {
  const t = useTranslations('configuracion.ProfesionalesPage');
  const color = profesional.color || colors.primary;
  const cantidadServicios = profesional.servicios?.length ?? 0;

  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: profesional.activo ? colors.surface : colors.surfaceSubtle,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer',
        opacity: profesional.activo ? 1 : 0.65,
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: '#FFF', fontSize: 15, fontWeight: 700,
      }}>
        {profesional.nombre.trim().charAt(0).toUpperCase() || '?'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 16, fontWeight: 700,
          color: profesional.activo ? colors.text : colors.placeholder,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {profesional.nombre_completo}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
          {cantidadServicios === 0
            ? t('noServices')
            : t('serviceCount', { count: cantidadServicios })}
        </p>
      </div>

      <PillToggle value={profesional.activo} onChange={onToggle} stopPropagation />

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

export default function ProfesionalesPage() {
  const t = useTranslations('configuracion.ProfesionalesPage');
  const router = useRouter();
  const { profesionales, loading, error, fetchProfesionales, toggleActivo } = useProfesionalStore();

  useEffect(() => { fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/profesionales/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
          {t('disclaimer')}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profesionales.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyState')}
            </p>
          ) : (
            profesionales.map(p => (
              <ProfesionalCard
                key={p.id}
                profesional={p}
                onEdit={() => router.push(`/configuracion/profesionales/${p.id}`)}
                onToggle={activo => toggleActivo(p.id, activo)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
