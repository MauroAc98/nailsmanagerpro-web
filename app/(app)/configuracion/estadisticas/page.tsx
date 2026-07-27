'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, shadows } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { statsService, DashboardStats } from '@/services/statsService';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatFecha(d: Date): string {
  return d.toISOString().split('T')[0];
}

function rangoDelMes(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
}

// ─────────────────────────────────────────────
// Barra de ranking — magnitud de una sola serie (servicios más pedidos).
// El nombre del servicio ya identifica la barra, así que un solo color
// (colors.primary) alcanza; la etiqueta de valor va afuera, en tinta de
// texto, nunca en el color de la barra.
// ─────────────────────────────────────────────
function BarraRanking({ nombre, cantidad, maxCantidad }: { nombre: string; cantidad: number; maxCantidad: number }) {
  const pct = maxCantidad > 0 ? Math.max((cantidad / maxCantidad) * 100, 4) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: colors.text, fontWeight: 600 }}>{nombre}</span>
        <span style={{ color: colors.subtext }}>{cantidad}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 5,
          backgroundColor: colors.primary, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat tile — identidad por swatch + etiqueta (nunca color en el número).
// ─────────────────────────────────────────────
function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1, backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: colors.subtext, fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, color: colors.textStrong }}>{value}</span>
    </div>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [viewDate, setViewDate] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [profesionalFiltro, setProfesionalFiltro] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProfesionales = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { desde, hasta } = rangoDelMes(viewDate);

    statsService.getDashboard(desde, hasta, profesionalFiltro ?? undefined)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(e => console.error('fetchDashboardStats:', e))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [viewDate, profesionalFiltro]);

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const servicios = stats?.servicios_mas_pedidos ?? [];
  const maxCantidad = servicios.reduce((max, s) => Math.max(max, s.cantidad), 0);
  const totalClientes = (stats?.clientes.nuevas ?? 0) + (stats?.clientes.recurrentes ?? 0);

  const { completados = 0, confirmados = 0, cancelados = 0 } = stats?.turnos_por_estado ?? {};
  const totalConCancelados = completados + confirmados + cancelados;
  const tasaCancelacion = totalConCancelados > 0 ? Math.round((cancelados / totalConCancelados) * 100) : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Estadísticas</h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Selector de mes */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
        }}>
          <button
            onClick={() => cambiarMes(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            onClick={() => cambiarMes(1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Selector de profesional — invisible con ≤1 profesional activa. Con
            superficie propia (igual que el de Agenda) y un chip "Todas"
            explícito, para que quede claro qué se está mirando apenas
            entrás — sin esto, sin selección no había ningún chip resaltado. */}
        {mostrarSelectorProfesional && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
          }}>
            <button
              onClick={() => setProfesionalFiltro(null)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${profesionalFiltro === null ? colors.primary : colors.divider}`,
                backgroundColor: profesionalFiltro === null ? colors.primary : colors.surface,
                color: profesionalFiltro === null ? '#FFF' : colors.text,
              }}
            >
              Todas
            </button>
            {activeProfesionales.map(p => {
              const selected = profesionalFiltro === p.id;
              const color = p.color || colors.primary;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfesionalFiltro(selected ? null : p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 20, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${selected ? color : colors.divider}`,
                    backgroundColor: selected ? color : colors.surface,
                    color: selected ? '#FFF' : colors.text,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                    backgroundColor: selected ? '#FFF' : color,
                  }} />
                  {p.nombre}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: colors.subtext, fontSize: 14, marginTop: 40 }}>Cargando...</p>
        ) : (
          <>
            {/* Hero figure — el número que lidera la pantalla */}
            <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
              <span style={{ fontSize: 48, fontWeight: 700, color: colors.textStrong, lineHeight: 1 }}>
                {stats?.total_turnos ?? 0}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext }}>turnos este período</p>
            </div>

            {/* Turnos por estado */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                Turnos por estado
              </h2>
              {totalConCancelados === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  No hay turnos este período.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <StatTile label="Completados" value={completados} color={colors.success} />
                    <StatTile label="Confirmados" value={confirmados} color={colors.muted} />
                    <StatTile label="Cancelados" value={cancelados} color={colors.danger} />
                  </div>
                  {tasaCancelacion !== null && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.subtext }}>
                      {tasaCancelacion}% de los turnos se cancelaron este período.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Clientas nuevas vs. recurrentes */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                Clientas
              </h2>
              {totalClientes === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  No hay turnos confirmados este período.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <StatTile label="Nuevas" value={stats!.clientes.nuevas} color={colors.chart1} />
                    <StatTile label="Recurrentes" value={stats!.clientes.recurrentes} color={colors.chart2} />
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, gap: 2 }}>
                    <div style={{ flex: stats!.clientes.nuevas || 0.0001, backgroundColor: colors.chart1, borderRadius: 4 }} />
                    <div style={{ flex: stats!.clientes.recurrentes || 0.0001, backgroundColor: colors.chart2, borderRadius: 4 }} />
                  </div>
                </>
              )}
            </div>

            {/* Servicios más pedidos */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                Servicios más pedidos
              </h2>
              {servicios.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  No hay servicios agendados este período.
                </p>
              ) : (
                <div style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 14, padding: '16px', display: 'flex',
                  flexDirection: 'column', gap: 14,
                }}>
                  {servicios.map(s => (
                    <BarraRanking key={s.servicio_id} nombre={s.nombre} cantidad={s.cantidad} maxCantidad={maxCantidad} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
