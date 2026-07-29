'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useServiciosStore, useServiciosFiltrados } from '@/store/useServicioStore';
import { Servicio } from '@/services/servicioService';
import { NAV_HEIGHT } from '@/constants/layout';

function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!value); }}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? withAlpha(colors.primary, '66') : colors.border,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: value ? colors.primary : colors.placeholder,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

function ServicioCard({
  servicio,
  onEdit,
  onToggle,
}: {
  servicio: Servicio;
  onEdit:   () => void;
  onToggle: (activo: boolean) => void;
}) {
  const precioLabel = servicio.precio ? `  ·  $${servicio.precio}` : '';

  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: servicio.activo ? colors.surface : colors.surfaceSubtle,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer',
        opacity: servicio.activo ? 1 : 0.65,
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 36, height: 36,
        backgroundColor: servicio.activo ? withAlpha(colors.primary, '15') : colors.surfaceSubtle,
        borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={servicio.activo ? colors.primary : colors.placeholder} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: servicio.activo ? colors.text : colors.placeholder }}>
          {servicio.nombre}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
          {servicio.duracion_minutos} min{precioLabel}
        </p>
      </div>

      <PillToggle value={servicio.activo} onChange={onToggle} />

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

export default function ServiciosPage() {
  const t = useTranslations('configuracion.ServiciosPage');
  const router = useRouter();
  const { loading, buscar, fetchServicios, toggleServicio, setBuscar } = useServiciosStore();
  const serviciosFiltrados = useServiciosFiltrados();

  useEffect(() => { fetchServicios(); }, []);


  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/servicios/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primary, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Search */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
          />
          {buscar && (
            <button onClick={() => setBuscar('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {serviciosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {buscar ? t('noResults') : t('emptyState')}
            </p>
          ) : (
            serviciosFiltrados.map(s => (
              <ServicioCard
                key={s.id}
                servicio={s}
                onEdit={() => router.push(`/configuracion/servicios/${s.id}`)}
                onToggle={activo => toggleServicio(s.id, activo)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
