'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { usePendientesDeCobroStore, usePendientesFiltrados } from '@/store/usePendientesDeCobroStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { alertDialog } from '@/store/useConfirmStore';
import { Turno } from '@/services/turnoService';

function formatFechaHora(fechaHora: string): string {
  const d = new Date(fechaHora.replace(' ', 'T'));
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

function PendienteCard({ turno, onCargarPrecio }: { turno: Turno; onCargarPrecio: () => void }) {
  const t = useTranslations('agenda.PendientesDeCobroPage');
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>
          {turno.cliente.nombre} {turno.cliente.apellido}
        </p>
        <span style={{ fontSize: 13, color: colors.subtext, whiteSpace: 'nowrap' }}>
          {formatFechaHora(turno.fecha_hora)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: colors.subtext }}>
        {turno.servicios.map(s => s.nombre).join(', ')}
      </p>

      <button
        onClick={onCargarPrecio}
        style={{
          alignSelf: 'flex-start',
          marginTop: 4,
          padding: '8px 14px',
          borderRadius: 10,
          border: 'none',
          backgroundColor: colors.primary,
          color: '#FFF',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('loadPriceButton')}
      </button>
    </div>
  );
}

export default function PendientesDeCobroPage() {
  const t = useTranslations('agenda.PendientesDeCobroPage');
  const { loading, error, buscar, setBuscar, fetchPendientes, actualizarPrecios } = usePendientesDeCobroStore();
  const pendientesFiltrados = usePendientesFiltrados();
  const { servicios, fetchServicios } = useServiciosStore();

  useEffect(() => {
    fetchPendientes();
    fetchServicios();
  }, []);

  const handleCargarPrecio = async (turno: Turno) => {
    const referencias = new Map(servicios.map(s => [s.id, s.precio]));
    const serviciosAPrecificar = turno.servicios.map(s => {
      const ref = referencias.get(s.id);
      return {
        servicio_id: s.id,
        nombre: s.nombre,
        precioReferencia: ref != null ? Number(ref) : null,
      };
    });

    const precios = await pedirPreciosServicios(serviciosAPrecificar);
    if (!precios) return;

    const result = await actualizarPrecios(turno.id, precios);
    if (result.success) showToast(t('saved'));
    else await alertDialog(result.message ?? t('saveError'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
        <p style={{ fontSize: 14, color: colors.subtext, margin: '4px 0 0' }}>{t('subtitle')}</p>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8,
          backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`,
        }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendientesFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {buscar ? t('noResults') : t('emptyState')}
            </p>
          ) : (
            pendientesFiltrados.map(turno => (
              <PendienteCard
                key={turno.id}
                turno={turno}
                onCargarPrecio={() => handleCargarPrecio(turno)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
