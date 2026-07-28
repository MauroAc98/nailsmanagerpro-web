'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, shadows } from '@/theme/colors';
import { statsService, DashboardStats } from '@/services/statsService';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatFecha(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  // Mismo filtro de profesional que el resto de la pantalla de Agenda —
  // si el dueño está mirando solo a una profesional, el resumen la refleja.
  profesionalId: number | null;
  // Mismo mes que está navegando el calendario de abajo — si cambia de mes
  // ahí, el resumen tiene que seguirlo, si no queda mostrando datos de un
  // mes distinto al que se está mirando sin ningún aviso.
  viewDate: Date;
}

// ─────────────────────────────────────────────
// ResumenMesCard — vistazo rápido del mes en el home (Agenda), sin repetir
// el detalle completo que ya vive en Configuración → Estadísticas.
// ─────────────────────────────────────────────
export function ResumenMesCard({ profesionalId, viewDate }: Props) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const esMesActual = viewDate.getFullYear() === new Date().getFullYear()
    && viewDate.getMonth() === new Date().getMonth();

  useEffect(() => {
    let cancelled = false;
    const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);

    statsService.getDashboard(formatFecha(desde), formatFecha(hasta), profesionalId ?? undefined)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(e => console.error('ResumenMesCard:', e));

    return () => { cancelled = true; };
  }, [profesionalId, viewDate]);

  // Sin datos todavía (cargando) o sin ningún turno este mes: no ocupar
  // espacio en el home con una tarjeta vacía.
  if (!stats || stats.total_turnos === 0) return null;

  const topServicio = stats.servicios_mas_pedidos[0]?.nombre;

  return (
    <button
      onClick={() => {
        const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const params = new URLSearchParams({ mes });
        if (profesionalId != null) params.set('profesional', String(profesionalId));
        router.push(`/configuracion/estadisticas?${params.toString()}`);
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', margin: '0 0 12px', padding: '14px 16px',
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        boxShadow: shadows.card, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: colors.subtext, textTransform: 'uppercase' }}>
            {esMesActual ? 'Estadísticas de este mes' : `Estadísticas de ${MONTHS[viewDate.getMonth()]}`}
          </p>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>
          {stats.total_turnos} turno{stats.total_turnos === 1 ? '' : 's'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
          {topServicio ? `Top: ${topServicio} · ` : ''}{stats.clientes.nuevas} clienta{stats.clientes.nuevas === 1 ? '' : 's'} nueva{stats.clientes.nuevas === 1 ? '' : 's'}
        </p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
